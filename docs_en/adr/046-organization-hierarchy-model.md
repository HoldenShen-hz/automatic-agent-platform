# ADR-046 Organization Hierarchy Model

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Enterprises have deep organizational hierarchies of business groups → departments → teams, and the platform needs to express this hierarchical relationship to support multi-level governance.

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
  compensate(operations: Compensatable[]): Compensatable[];  // Roll back on failure, return unrecovered operations
  audit(): void;                      // Record the complete change trajectory
}
```

### Hierarchy Governance Policy (v4.3 OrgNode hierarchy)

> Note: R5-66 Fix - v4.3 has replaced CEO/VP governance hierarchy with OrgNode hierarchy.

| Level | Governance Autonomy | Approval Chain (OrgNode) |
|-------|---------------------|--------------------------|
| Company-level | Platform managed | OrgNode(root)/Governance Committee |
| Business Group-level | Business Group managed | OrgNode(business_group) |
| Department-level | Department managed | OrgNode(department) |
| Team-level | Team managed | OrgNode(team) |
| Individual-level | Self managed | OrgNode(individual) |

### Relationship with Tenants

- Tenant is the top-level isolation unit
- Organizational hierarchy is subdivided within tenant
- No organizational relationships across tenants

### OrgTree Cascade Change Compensation Semantics

Organizational changes (such as department dissolution, team merger, personnel transfer) have cascade effects. OrgTreeSaga guarantees:

1. **Prepare Phase**: Collect all affected nodes, child nodes, associated permissions, and associated approval chains
2. **Commit Phase**: Atomically execute all changes
3. **Compensate Phase**: On any change failure, roll back all committed changes in reverse order, and return the list of unrecovered operations
4. **Audit Phase**: Record the complete change trajectory, including compensation execution results

## Consequences

Advantages:

- Hierarchy model matches enterprise reality
- Multi-level governance improves management efficiency
- Approval chains are clear

Drawbacks:

- Hierarchy maintenance complexity
- Cross-level collaboration requires additional design

## Cross References

- [ADR-002 Division System](./002-division-system.md)
- [ADR-047 Organization Approval Routing](./047-organization-approval-routing.md)

## Source Section

- `§46` Organization Hierarchy Model