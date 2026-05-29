# ADR-047 Organization Architecture Approval Routing

- Status: Accepted
- Decision Date: 2026-04-20

## Background

Approval requests need to be dynamically routed to the correct approver based on organizational hierarchy, rather than hardcoded approval chains.

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
| multi_party | Multi-party countersign |
| delegated | Delegated approval |
| sequential_chain | Sequential approval chain |

### ApprovalTimeout Strategies

| Strategy | Description |
|----------|-------------|
| warn | Warning before timeout |
| escalate | Escalate after timeout |
| break_glass | Trigger break-glass process, requires double approval to continue |

Note: `auto_action` strategy has been removed. After timeout, must go through break-glass + double approval process, prohibit automatic execution of preset actions.

### Routing Rule Engine

- Dynamic routing based on organizational hierarchy, role, risk level
- Supports approval delegation
- Supports approval expedited processing

## Consequences

Advantages:

- Dynamic routing adapts to organizational changes
- Multi-type approval flows support complex scenarios
- Automated timeout handling

Trade-offs:

- Rule engine complexity
- Routing performance impact

## Cross References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [Approval / HITL Contract](../contracts/approval_and_hitl_contract.md)

## Source Section

- `§47` Organization Architecture Approval Routing