# ADR-061 Agent Unified Lifecycle Management Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

An Agent is composed of multiple loosely coupled components, lacking unified version and lifecycle management.

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
|-------|-------------|
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
- After requirements_locked, frivolous requirement changes are no longer accepted; changes must go through the change committee process
- Archived state preserves audit history and cannot be reverted to active state
- Superseded is the terminal state, indicating complete replacement by a new version

## v4.3 ADR Remediation

- R3-52: This ADR originally defined an 8-state lifecycle (draft/requirements_locked/testing/staging/production/deprecated/retired/archived). The root cause was that the lifecycle ADR omitted the superseded terminal state. Fix: The main text now adds the superseded terminal state, forming a complete 9-state state machine, aligned with §61.3 architectural requirements.

- Semantic versioning (major.minor.patch)
- Version compatibility checks
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

Benefits:

- Unified management improves maintainability
- Versioning supports rollback
- Dependency management prevents conflicts

Costs:

- Component version coordination is complex
- Lifecycle state machine maintenance overhead

## Cross References

- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)
- [ADR-029 OAPEFLIR Controlled Cognition Kernel](./029-oapeflir-controlled-cognition-kernel.md)

## Source Section

- `§61` Agent Unified Lifecycle Management Architecture
