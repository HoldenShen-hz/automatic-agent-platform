# ADR-051 Tiered Governance Delegation

- Status: Accepted
- Decision Date: 2026-04-20

## Background

Platform administrators cannot manage all affairs, and governance authority needs to be delegated to subordinate organizations.

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

### Delegation Tiers

| Tier | Delegable Permissions | Constraints |
|------|----------------------|-------------|
| Platform-level | Only permissions outside NonOverridableInvariant | Must comply with non-overridable constraints such as security boundaries, audit requirements |
| Business Group-level | Permissions within business group | Subject to upper-level delegation constraints |
| Department-level | Permissions within department | Subject to upper-level delegation constraints |
| Team-level | Limited permissions | Subject to upper-level delegation constraints |

Note: NonOverridableInvariant is a platform-level security invariant, no delegation can override this type of constraint (such as security boundaries, audit requirements, etc.). Platform-level delegation is not "all permissions", but rather restricted all permissions after excluding NonOverridableInvariant.

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
- Periodically review delegation validity

## Consequences

Advantages:

- Distributed governance improves efficiency
- Constraint mechanism prevents permission abuse
- Audit tracking ensures compliance

Trade-offs:

- Delegation relationships are complex
- Permission recovery requires complete process

## Cross References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [ADR-027 Security Architecture](./027-security-architecture.md)

## Source Section

- `§51` Tiered Governance Delegation