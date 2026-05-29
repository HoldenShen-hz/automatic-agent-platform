# ADR-046 Organization Hierarchy Model

- Status: Accepted
- Decision Date: 2026-04-20

## Background

Enterprises have deep organizational hierarchies from business groups to departments to teams, and the platform needs to express this hierarchical relationship and support tiered governance.

## Decision

### Organizational Hierarchy Structure

```typescript
interface OrganizationHierarchy {
  root: OrgNode;           // Root node (company)
  business_groups: OrgNode[];  // Business groups
  departments: OrgNode[];     // Departments
  teams: OrgNode[];           // Teams
  individuals: OrgNode[];     // Individuals
}

interface OrgNode {
  node_id: string;
  name: string;
  type: OrgNodeType;
  parent_id?: string;
  children?: string[];
  metadata: OrgMetadata;
}

// OrgTree cascade operations use Saga semantics
interface OrgTreeSaga {
  prepare(): Compensatable[];        // Collect all pending cascade changes
  commit(): void;                     // Atomically commit all changes
  compensate(operations: Compensatable[]): Compensatable[];  // Rollback on failure, return unrecovered operations
  audit(): void;                      // Record complete change trajectory
}
```

### Tiered Governance Policy (v4.3 OrgNode hierarchy)

> Note: R5-66 Fix - v4.3 has replaced CEO/VP governance hierarchy with OrgNode hierarchy.

| Tier | Governance Autonomy | Approval Chain (OrgNode) |
|------|-------------------|------------------------|
| Company-level | Platform managed | OrgNode(root)/Governance Committee |
| Business Group-level | Business group managed | OrgNode(business_group) |
| Department-level | Department managed | OrgNode(department) |
| Team-level | Team managed | OrgNode(team) |
| Individual-level | Individual managed | OrgNode(individual) |

### Relationship with Tenant

- Tenant is the top-level isolation unit
- Organization hierarchy细分 within tenant
- No organizational relationship across tenants

### OrgTree Cascade Change Compensate Semantics

Organizational changes (such as department dissolution, team merger, personnel transfer) have cascade effects. OrgTreeSaga guarantees:

1. **Preparation phase**: Collect all affected nodes, child nodes, associated permissions, associated approval chains
2. **Commit phase**: Atomically execute all changes
3. **Compensate phase**: On any change failure, rollback all committed changes in reverse order, return list of unrecovered operations
4. **Audit phase**: Record complete change trajectory, including compensate execution results

## Consequences

Advantages:

- Hierarchy model matches enterprise reality
- Tiered governance improves management efficiency
- Approval chains are clear

Trade-offs:

- Hierarchy maintenance complexity
- Cross-tier collaboration requires additional design

## Cross References

- [ADR-002 Division System](./002-division-system.md)
- [ADR-047 Organization Architecture Approval Routing](./047-organization-approval-routing.md)

## Source Section

- `§46` Organization Hierarchy Model