# Org Hierarchy And Dynamic Approval Contract

## 1. Scope

This contract defines the organizational model, dynamic approval, and department-level compliance inheritance for `§46-§47` and `§49`.

## 2. Canonical Objects

- `OrgNode`
- `OrgHierarchySnapshot`
- `ApprovalRouteRequest`
- `ApprovalRouteDecision`
- `ApprovalLimitMatrix`
- `CompliancePolicyBinding`

## 3. `OrgNode` Minimum Fields

- `org_node_id`
- `node_type`: `enterprise | business_unit | department | team | seat`
- `display_name`
- `parent_node_id?`
- `effective_policies`
- `status`

Rules:

- The org tree must be acyclic.
- Seat / user nodes can only be attached under team or department.

## 4. Dynamic Approval Routing

`ApprovalRouteDecision` minimum fields:

- `route_id`
- `matched_org_node_id`
- `approver_chain`
- `limit_rule_id`
- `escalation_rule_id?`
- `delegation_applied`

Routing input must include at least:

- requester
- org node
- risk level
- amount / impact
- resource scope

## 5. Inheritance and Override

- Approval limits and compliance policies inherit downward by default.
- Only within the boundaries permitted by their superior can subordinates tighten or partially override.
- Relaxing restrictions requires authorization from the superior.

## 6. Test Requirements

- unit: org tree, routing matching, limit matrix
- integration: approval requests cross-org routing and escalation
- contract: high-risk requests with no org affiliation must not be auto-routed to approved