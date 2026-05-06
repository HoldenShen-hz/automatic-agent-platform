# ADR-046 Organization Hierarchy Model

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Enterprises have deep organizational hierarchies from business groups → departments → teams. The platform needs to express this hierarchy to support hierarchical governance.

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
```

### Hierarchical Governance Policy (OrgNode Level, v4.3 §46-§51)

| Level | Governance Autonomy | Approval Chain |
|-------|---------------------|----------------|
| Root (company-level) | Platform managed | OrgNode governance chain |
| Business group level | Business group managed | OrgNode approval routing |
| Department level | Department managed | OrgNode approval routing |
| Team level | Team managed | OrgNode approval routing |
| Individual level | Self-managed | OrgNode approval routing |

Note: v4.3 uses OrgNode levels instead of CEO/VP naming system. Approval chains route dynamically through ApprovalFlow + OrgNode hierarchy.

### Relationship with Tenants

- Tenant is the top-level isolation unit
- Organization hierarchy subdivides within tenant
- No organization relationships across tenants

### OrgTree Cascading Changes (§2.4 Saga Semantics)

OrgTree changes (department merges, team splits, personnel transfers) must follow four-phase Saga semantics:

| Phase | Description | Compensation Trigger |
|-------|-------------|----------------------|
| prepare | Validate change feasibility, generate impact analysis, lock affected child nodes | N/A |
| commit | Execute organizational structure changes, update all associated approval chains and permissions | compensate |
| compensate | If change fails, rollback to original organizational structure, restore affected nodes to original state | Recursive compensation until success or human intervention |
| audit | Record change events, generate change reports, notify stakeholders | N/A |

Compensation transaction requirements:
- Each commit operation must record the inverse operation to compensation_log
- compensate phase must ensure idempotency, safe for retry
- audit phase must record complete prepare/commit/compensate chain timestamps and operator identity
- If compensate fails, system enters `saga_in_flight` state and alerts, requiring human confirmation to continue

## Consequences

Pros:

- Hierarchy model matches enterprise reality
- Hierarchical governance improves management efficiency
- Approval chains are clear

Cons:

- Hierarchy maintenance complexity
- Cross-level collaboration requires extra design

## Cross-references

- [ADR-002 Division System](./002-division-system.md)
- [ADR-047 Organization Approval Routing](./047-organization-approval-routing.md)

## Source Section

- `§46` Organization Hierarchy Model
