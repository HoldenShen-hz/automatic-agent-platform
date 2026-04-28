# ADR-046 Organization Hierarchy Model

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Enterprises have deep organizational hierarchies of business group -> department -> team, and the platform needs to express this hierarchical relationship and support tiered governance.

## Decision

### Organizational Hierarchy Structure

```typescript
interface OrganizationHierarchy {
  root: OrgNode;              // Root node (company)
  business_groups: OrgNode[]; // Business groups
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

### Tiered Governance Strategy

| Level | Governance Autonomy | Approval Chain |
|-------|---------------------|----------------|
| Company Level | Platform management | CEO/Governance Committee |
| Business Group Level | Business group management | VP |
| Department Level | Department management | Department head |
| Team Level | Team management | Team Lead |

### Relationship with Tenants

- Tenant is the top-level isolation unit
- Organization hierarchy is subdivided within tenant
- No organizational relationships across tenants

## Consequences

Positive:

- Hierarchy model matches actual enterprise structure
- Tiered governance improves management efficiency
- Clear approval chains

Negative:

- Hierarchy maintenance complexity
- Cross-level collaboration requires additional design

## Cross-References

- [ADR-002 Division System](./002-division-system.md)
- [ADR-047 Organization Approval Routing](./047-organization-approval-routing.md)

## Source Sections

- `§46` Organization Hierarchy Model
