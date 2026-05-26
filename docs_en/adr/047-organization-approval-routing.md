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
| single | Single approver |
| multi_party | Multi-party countersignature |
| delegated | Delegated approval |
| sequential_chain | Sequential approval chain |

### ApprovalTimeout Strategies

| Strategy | Description |
|----------|-------------|
| warn | Warning before timeout |
| escalate | Escalate after timeout |
| break_glass | Trigger break-glass process, requires dual approval to continue |

Note: The `auto_action` strategy has been removed. After timeout, must go through break-glass + dual approval process; automatic execution of preset actions is prohibited.

### Routing Rule Engine

- Dynamic routing based on organizational hierarchy, roles, risk level
- Supports approval delegation
- Supports approval expedited handling

## Consequences

Pros:

- Dynamic routing adapts to organizational changes
- Multi-type approval flows support complex scenarios
- Timeout handling automation

Cons:

- Rule engine complexity
- Routing performance impact

## Cross References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [Approval / HITL Contract](../contracts/approval_and_hitl_contract.md)

## Source Sections

- `§47` Organization Approval Routing