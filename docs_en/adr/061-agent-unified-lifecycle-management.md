# ADR-061 Agent Unified Lifecycle Management Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Background

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
|-------|-------------|
| draft | Draft |
| testing | Testing |
| staging | Pre-release |
| canary | Canary rollout in progress |
| active | Currently active version |
| paused | Paused from promotion |
| deprecated | Deprecated |
| archived | Archived |
| removed | Removed (terminal state) |

Constraints:
- State transition order: draft → testing → staging → canary → active → paused → deprecated → archived → removed
- `canary` and `active` respectively correspond to controlled rollout and default active version, no longer using `production / retired / superseded` mixed expressions.
- Archived state retains audit history, cannot revert to active.
- removed is terminal state, indicating both runtime surface and projection have completed cleanup.

## v4.3 ADR Remediation

- R3-52: This ADR previously followed `requirements_locked / production / retired / superseded` historical terms, not aligned with §61.3 rollout lifecycle. Fix: Body now unified to `draft / testing / staging / canary / active / paused / deprecated / archived / removed` nine-state lifecycle.

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

Advantages:

- Unified management improves maintainability
- Versioning supports rollback
- Dependency management prevents conflicts

Trade-offs:

- Component version coordination is complex
- Lifecycle state machine maintenance cost

## Cross References

- [ADR-075 Six-level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)
- [ADR-029 OAPEFLIR Controlled Cognition Kernel](./029-oapeflir-controlled-cognition-kernel.md)

## Source Section

- `§61` Agent Unified Lifecycle Management Architecture