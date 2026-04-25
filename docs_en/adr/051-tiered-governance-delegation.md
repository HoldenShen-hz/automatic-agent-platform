# ADR-051 Tiered Governance Delegation

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Platform administrators cannot manage all affairs and need to delegate governance authority to subordinate organizations.

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

| Level | Delegatable Permissions |
|-------|-------------------------|
| Platform | All permissions |
| Business Group | Within business group |
| Department | Within department |
| Team | Limited permissions |

### Constraints

| Constraint Type | Description |
|-----------------|-------------|
| budget_limit | Budget cap |
| risk_threshold | Risk cap |
| approval_required | Requires upper-level approval |
| time_window | Valid time window |

### Delegation Audit

- All delegation operations recorded in audit logs
- Delegation relationship changes notify both parties
- Periodic review of delegation validity

## Consequences

Positive:

- Distributed governance improves efficiency
- Constraint mechanism prevents permission abuse
- Audit trail ensures compliance

Negative:

- Delegation relationships are complex
- Permission revocation requires full process

## Cross-References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [ADR-027 Security Architecture](./027-security-architecture.md)

## Source Sections

- `§51` Tiered Governance Delegation