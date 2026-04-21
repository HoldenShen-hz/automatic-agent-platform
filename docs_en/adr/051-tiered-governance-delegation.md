# ADR-051 Tiered Governance Delegation

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Platform governance requires clear delegation mechanisms at multiple levels, from platform operators to department administrators to individual users.

## Decision

### Delegation Scope

```typescript
interface DelegationScope {
  scope_type: 'platform' | 'tenant' | 'department' | 'team' | 'user';
  scope_id: string;
  permissions: Permission[];
  expires_at?: string;
}
```

### Delegation Chain

| Level | Delegator | Delegatee | Scope |
|-------|-----------|-----------|-------|
| Platform | Platform admin | Tenant admin | Platform-level |
| Tenant | Tenant admin | Dept admin | Tenant-level |
| Department | Dept admin | Team lead | Department-level |
| Team | Team lead | User | Team-level |

### Delegation Depth Limit

- Maximum delegation depth: 3 levels
- Prevents excessive delegation chains
- Depth limit enforced by GovernanceService

### Override Rules

- Platform-level policies cannot be overridden
- Tenant-level policies can be overridden by platform
- Department-level policies can be overridden by tenant

## Consequences

Positive:
- Clear delegation chain improves governance
- Depth limit prevents delegation abuse
- Override rules ensure policy consistency

Negative:
- Delegation management complexity
- Depth limit may restrict legitimate use cases

Trade-offs:
- Governance vs. flexibility
- Control vs. simplicity

## Cross-References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [ADR-085 Organization Governance and Knowledge Boundary](./085-organization-governance-and-knowledge-boundary.md)

## Source Sections

- `§51` Tiered Governance Delegation