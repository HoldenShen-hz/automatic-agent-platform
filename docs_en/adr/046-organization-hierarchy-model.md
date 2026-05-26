# ADR-046 Organization Hierarchy Model

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Enterprises have deep organizational hierarchies of business group -> department -> team, and the platform needs to express this hierarchical relationship to support tiered governance.

## Decision

### Organization Hierarchy Structure

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
  compensate(operations: Compensatable[]): Compensatable[];  // Reverse rollback on failure, return unrecovered operations
  audit(): void;                      // Record complete change trajectory
}
```

### Tiered Governance Policy (v4.3 OrgNode hierarchy)

> Note: R5-66 Fix - v4.3 has replaced CEO/VP governance hierarchy with OrgNode hierarchy.

| Level | Governance Autonomy | Approval Chain (OrgNode) |
|-------|---------------------|-------------------------|
| Company Level | Platform managed | OrgNode(root)/Governance Committee |
| Business Group Level | Business group managed | OrgNode(business_group) |
| Department Level | Department managed | OrgNode(department) |
| Team Level | Team managed | OrgNode(team) |
| Individual Level | Individual managed | OrgNode(individual) |

### Relationship with Tenant

- Tenant is the top-level isolation unit
- Organization hierarchy is subdivided within tenant
- No organizational relationship across tenants

### OrgTree Cascade Change Compensating Semantics

Organization changes (such as department dissolution, team merger, personnel transfer) have cascade effects. OrgTreeSaga guarantees:

1. **Prepare Phase**: Collect all affected nodes, child nodes, associated permissions, associated approval chains
2. **Commit Phase**: Atomically execute all changes
3. **Compensate Phase**: When any change fails, reverse rollback all committed changes, return list of unrecovered operations
4. **Audit Phase**: Record complete change trajectory, including compensation execution results

## Consequences

Pros:

- Hierarchical model matches enterprise reality
- Tiered governance improves management efficiency
- Clear approval chains

Cons:

- Hierarchy maintenance complexity
- Cross-level collaboration requires additional design

## Cross References

- [ADR-002 Division System](./002-division-system.md)
- [ADR-047 Organization Approval Routing](./047-organization-approval-routing.md)

## Source Sections

- `§46` Organization Hierarchy Model