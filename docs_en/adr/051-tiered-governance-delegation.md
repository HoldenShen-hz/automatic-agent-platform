# ADR-051 Tiered Governance Delegation

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Platform administrators cannot manage all affairs. Governance authority needs to be delegated to subordinate organizations.

## Decision

### Delegation Model

```typescript
interface GovernanceDelegation {
  delegation_id: string;
  delegator_id: string;       // Delegator
  delegate_id: string;         // Delegate
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
| Platform level | All permissions (but must exclude NonOverridableInvariantRegistry) |
| Business group level | Permissions within business group |
| Department level | Permissions within department |
| Team level | Limited permissions |

Note: §2.4 NonOverridableInvariantRegistry cannot be disabled or overridden by any administrator or domain owner. Platform-level delegation permissions must also comply with this constraint, and cannot delegate control of NonOverridableInvariantRegistry.

### Constraint Types

| Constraint Type | Description |
|-----------------|-------------|
| budget_limit | Budget upper limit |
| risk_threshold | Risk upper limit |
| approval_required | Requires upper-level approval |
| time_window | Valid time window |

### Delegation Audit

- All delegation operations recorded in audit log
- Delegation relationship changes notify both parties
- Regular review of delegation validity

## Consequences

Pros:

- Distributed governance improves efficiency
- Constraint mechanism prevents permission abuse
- Audit tracking ensures compliance

Cons:

- Delegation relationships are complex
- Permission recovery requires complete process

## Cross-references

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [ADR-027 Security Architecture](./027-security-architecture.md)

## Source Section

- `§51` Tiered Governance Delegation
