# ADR-047 Organization Approval Routing

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Approval requests need to be dynamically routed to the correct approver based on organization structure, rather than hardcoded approval chains.

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
| multi_party | Multi-party co-signing |
| delegated | Delegated approval |
| sequential_chain | Sequential approval chain |

### ApprovalTimeout Strategy

| Strategy | Description |
|----------|-------------|
| warn | Warning before timeout |
| escalate | Escalate after timeout |
| break_glass | Trigger break-glass process, requiring dual approval to continue |

Note: The `auto_action` strategy has been removed. After timeout, must go through break-glass + dual approval process. Automated preset actions are prohibited.

### Routing Rules Engine

- Dynamic routing based on organization hierarchy, roles, risk levels
- Support for approval delegation
- Support for approval expedited processing

## Consequences

Pros:

- Dynamic routing adapts to organizational changes
- Multi-type approval flows support complex scenarios
- Automated timeout handling

Cons:

- Rules engine complexity
- Routing performance impact

## Cross References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [Approval / HITL Contract](../contracts/approval_and_hitl_contract.md)

## Source Section

- `§47` Organization Approval Routing