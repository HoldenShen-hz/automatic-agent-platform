# ADR-051 Tiered Governance Delegation

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Platform administrators cannot manage all affairs, so governance rights need to be delegated to subordinate organizations.

## Decision

### Delegation Model

```typescript
interface GovernanceDelegation {
  delegation_id: string;
  delegator_id: string;       // Delegator
  delegate_id: string;         // Delegatee
  scope: DelegationScope;
  permissions: Permission[];
  constraints: DelegationConstraint[];
  valid_from: string;
  valid_until?: string;
  revocable: boolean;
}

interface DelegationScope {
  organization_level: OrgLevel;
  resource_types: ResourceType[];
  max_actions_per_day?: number;
}
```

### Delegation Levels

| Level | Delegable Permissions | Constraints |
|-------|----------------------|-------------|
| Platform Level | Permissions only outside NonOverridableInvariant | Must comply with non-overridable constraints like security boundaries, audit requirements |
| Business Group Level | Within business group | Subject to upper-level delegation constraints |
| Department Level | Within department | Subject to upper-level delegation constraints |
| Team Level | Limited permissions | Subject to upper-level delegation constraints |

Note: NonOverridableInvariant is a platform-level security invariant that no delegation can override (such as security boundaries, audit requirements, etc.). Platform-level delegation is not "all permissions" but restricted all permissions after excluding NonOverridableInvariant.

### Constraint Types

| Constraint Type | Description |
|----------------|-------------|
| budget_limit | Budget cap |
| risk_threshold | Risk cap |
| approval_required | Requires upper-level approval |
| time_window | Valid time window |

### Delegation Audit

- All delegation operations record audit logs
- Delegation relationship changes notify both parties
- Periodic review of delegation validity

## Consequences

Pros:

- Distributed governance improves efficiency
- Constraint mechanism prevents permission abuse
- Audit tracking ensures compliance

Cons:

- Delegation relationships are complex
- Permission recovery requires complete process

## Cross References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [ADR-027 Security and Reliability Architecture](./027-security-architecture.md)

## Source Sections

- `§51` Tiered Governance Delegation