# ADR-047 Organization Approval Routing

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Approval requests need to be dynamically routed to the correct approver based on organizational structure, rather than hardcoded approval chains.

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

- Dynamic routing based on organizational hierarchy, roles, and risk levels
- Supports approval delegation
- Supports approval expedited processing

## Consequences

Positive:

- Dynamic routing adapts to organizational changes
- Multi-type approval flows support complex scenarios
- Automated timeout handling

Negative:

- Rules engine complexity
- Routing performance impact

## Cross-References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [Approval / HITL Contract](../contracts/approval_and_hitl_contract.md)

## Source Sections

- `§47` Organization Approval Routing
