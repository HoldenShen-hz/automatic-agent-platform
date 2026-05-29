# ADR-046 Organization Hierarchy Model

- Status：Accepted
- Decision Date：2026-04-20

## Background

Enterprises have deep organizational hierarchies of business group → department → team, and the platform needs to express this hierarchical relationship to support tiered governance.

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
  compensate(operations: Compensatable[]): Compensatable[];  // On failure, rollback in reverse, return list of operations not recovered
  audit(): void;                      // Record complete change trajectory
}
```

### Tiered Governance Strategy (v4.3 OrgNode hierarchy)

> Note: R5-66 Fix - v4.3 has replaced CEO/VP governance hierarchy with OrgNode hierarchy.

| Level | Governance Autonomy | Approval Chain (OrgNode) |
|------|-----------|-------------------|
| Company level | Platform management | OrgNode(root)/Governance Committee |
| Business group level | Business group management | OrgNode(business_group) |
| Department level | Department management | OrgNode(department) |
| Team level | Team management | OrgNode(team) |
| Individual level | Individual management | OrgNode(individual) |

### Relationship with Tenant

- tenant is the top-level isolation unit
- Organization hierarchy is subdivided within tenant
- No organizational relationships across tenants

### OrgTree Cascade Change Compensation Semantics

Organizational architecture changes (such as department dissolution, team merger, personnel transfer) have cascade effects. OrgTreeSaga ensures:

1. **Prepare phase**: Collect all affected nodes, child nodes, associated permissions, associated approval chains
2. **Commit phase**: Atomically execute all changes
3. **Compensate phase**: If any change fails, rollback all committed changes in reverse, return list of unrecovered operations
4. **Audit phase**: Record complete change trajectory, including compensation execution results

## Consequences

Advantages:

- Hierarchy model matches enterprise reality
- Tiered governance improves management efficiency
- Approval chain is clear

Costs:

- Hierarchy maintenance complexity
- Cross-level collaboration requires additional design

## Cross-references

- [ADR-002 Division System](./002-division-system.md)
- [ADR-047 Organization Architecture Approval Routing](./047-organization-approval-routing.md)

## Source Section

- `§46` Organization Hierarchy Model