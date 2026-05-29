# ADR-047 Organization Architecture Approval Routing

- Status：Accepted
- Decision Date：2026-04-20

## Background

Approval requests need to be dynamically routed to the correct approver based on organizational architecture, rather than having hard-coded approval chains.

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
|------|------|
| single | Single person approval |
| multi_party | Multi-party countersign |
| delegated | Delegated approval |
| sequential_chain | Sequential approval chain |

### ApprovalTimeout Policy

| Policy | Description |
|------|------|
| warn | Warning before timeout |
| escalate | Escalate after timeout |
| break_glass | Trigger break-glass process, requires dual approval to continue |

Note: `auto_action` policy has been removed. After timeout, must go through break-glass + dual approval process, automatic execution of preset actions is prohibited.

### Routing Rule Engine

- Dynamically routes based on organization hierarchy, role, risk level
- Supports approval delegation
- Supports approval urgency

## Consequences

Advantages:

- Dynamic routing adapts to organizational changes
- Multiple approval flow types support complex scenarios
- Timeout handling automation

Costs:

- Rule engine complexity
- Routing performance impact

## Cross-references

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [Approval / HITL Contract](../contracts/approval_and_hitl_contract.md)

## Source Section

- `§47` Organization Architecture Approval Routing