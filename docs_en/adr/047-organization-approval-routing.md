# ADR-047 Organization Approval Routing

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Approval requests need to be dynamically routed to the correct approver based on organizational structure, not hard-coded approval chains.

## Decision

### ApproverRule

```typescript
interface ApproverRule {
  rule_id: string;
  name: string;
  condition: ApprovalCondition;
  approver_type: ApproverType;
  escalation_path?: string[];
}

type ApproverType = 'user' | 'role' | 'team' | 'on_call';
```

### ApprovalFlow Types

| Type | Description |
|------|-------------|
| single | Single person approval |
| multi_party | Multi-party countersignature |
| delegated | Delegated approval |
| sequential_chain | Sequential approval chain |

### ApprovalTimeout Strategy

| Strategy | Description |
|----------|-------------|
| warn | Warning before timeout |
| escalate | Escalate after timeout |
| auto_action | Auto-execute preset action after timeout |

### Routing Rules Engine

- Dynamic routing based on organizational hierarchy, roles, risk level
- Supports approval delegation
- Supports approval urgent handling

## Consequences

Positive:
- Dynamic routing adapts to organizational changes
- Multi-type approval flows support complex scenarios
- Automated timeout handling

Negative:
- Rules engine complexity
- Routing performance impact

Trade-offs:
- Flexibility vs. complexity
- Automation vs. control

## Cross-References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [ADR-085 Organization Governance and Knowledge Boundary](./085-organization-governance-and-knowledge-boundary.md)

## Source Sections

- `§47` Organizational Approval Routing