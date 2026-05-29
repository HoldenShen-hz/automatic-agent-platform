# ADR-049 Department Compliance Policy Engine

- Status: Accepted
- Decision Date: 2026-04-20

## Background

Different departments (finance, R&D, marketing) have different compliance requirements, and the platform needs to support department-level compliance policy customization.

## Decision

### CompliancePolicy Structure

```typescript
interface CompliancePolicy {
  policy_id: string;
  org_node_id: string;
  rules: ComplianceRule[];
  enforced: boolean;
  version: string;
}

interface ComplianceRule {
  rule_id: string;
  name: string;
  description: string;
  condition: string;
  action: ComplianceAction;
  severity: 'warning' | 'error' | 'block';
}
```

### Rule Types

| Type | Description |
|------|-------------|
| data_retention | Data retention period |
| access_control | Access control |
| audit_logging | Audit logging |
| encryption | Encryption requirements |
| data_classification | Data classification |

### Policy Inheritance and Override

- Sub-departments inherit parent department policies
- Sub-departments can override parent department policies (more strict)
- Platform-level policies cannot be overridden
- `org_node_id` must point to `OrgNodeType.department` node, no longer introducing separate `department_id` naming branch

### Compliance Checkpoints

- Check before task execution
- Check after task execution
- Periodic scan check

## Consequences

Advantages:

- Differentiated compliance supports business needs
- Inheritance mechanism reduces duplicate configuration
- Checkpoint mechanism ensures compliance implementation

Trade-offs:

- Policy management complexity
- Override rules may cause confusion

## Cross References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [Platform Architecture §23 Compliance and Data Governance](../architecture/00-platform-architecture.md)

## Source Section

- `§49` Department Compliance Policy Engine