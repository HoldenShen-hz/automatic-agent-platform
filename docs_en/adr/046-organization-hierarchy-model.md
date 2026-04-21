# ADR-046 Organization Hierarchy Model

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Enterprises have deep organizational hierarchies from business groups → departments → teams, and the platform needs to express these hierarchical relationships and support hierarchical governance.

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
```

### Hierarchical Governance Policy

| Level | Governance Autonomy | Approval Chain |
|-------|---------------------|---------------|
| Company-level | Platform managed | CEO/Governance Committee |
| Business group | Business group managed | VP |
| Department-level | Department managed | Department head |
| Team-level | Team managed | Team Lead |

### Relationship with Tenant

- Tenant is the top-level isolation unit
- Organization hierarchy subdivides within tenant
- No organizational relationship across tenants

## Consequences

Positive:
- Hierarchy model matches enterprise reality
- Hierarchical governance improves management efficiency
- Approval chain is clear

Negative:
- Hierarchy maintenance complexity
- Cross-level collaboration requires additional design

Trade-offs:
- Structure vs. flexibility
- Control vs. autonomy

## Cross-References

- [ADR-002 Division System](./002-division-system.md)
- [ADR-047 Organization Approval Routing](./047-organization-approval-routing.md)

## Source Sections

- `§46` Organizational Hierarchy Model