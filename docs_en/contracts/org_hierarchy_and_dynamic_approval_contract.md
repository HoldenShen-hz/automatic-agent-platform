# Org Hierarchy And Dynamic Approval Contract

## 1. Scope

This contract defines the organization model, dynamic approval, and department-level compliance inheritance as specified in `§46-§47` and `§49`.

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

- Organization tree must be acyclic.
- Seat / user nodes may only be attached under team or department.

## 4. Dynamic Approval Routing

`ApprovalRouteDecision` minimum fields:

- `route_id`
- `matched_org_node_id`
- `approver_chain`
- `limit_rule_id`
- `escalation_rule_id?`
- `delegation_applied`

Routing input must include at minimum:

- requester
- org node
- risk level
- amount / impact
- resource scope

## 5. Inheritance And Override

- Approval limits and compliance policies inherit downward by default.
- Lower levels may only tighten or partially override within boundaries allowed by upper level.
- Relaxing restrictions requires upper-level authorization.

## 6. Test Requirements

- unit: organization tree, route matching, limit matrix
- integration: approval request cross-organization routing and escalation
- contract: high-risk requests without organization affiliation must not auto-route to approved