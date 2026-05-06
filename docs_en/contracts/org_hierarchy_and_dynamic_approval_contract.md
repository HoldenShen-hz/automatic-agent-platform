# Org Hierarchy And Dynamic Approval Contract

## 1. Scope

This contract defines the organization model, dynamic approval, and department-level compliance inheritance for `§46-§47` and `§49`.

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
- seat / user nodes can only be attached under team or department.

## 4. Dynamic Approval Routing

`ApprovalRouteDecision` Minimum Fields:

- `route_id`
- `matched_org_node_id`
- `approver_chain`
- `limit_rule_id`
- `escalation_rule_id?`
- `delegation_applied`

Route input must include at minimum:

- requester
- org node
- risk level
- amount / impact
- resource scope

## 5. Inheritance and Override

- Approval limits and compliance policies inherit downward by default.
- Subordinates can only tighten or partially override within the boundaries allowed by their superiors.
- Relaxing restrictions requires superior authorization.

## 6. Test Requirements

- unit: organization tree, route matching, limit matrix
- integration: approval request routing and escalation across organizations
- contract: high-risk requests without organization affiliation must not auto-route to approved

## v4.3 Contract Remediation

- T-45B: The early version of this document only froze organization tree and approval routing minimum objects, did not add v4.3 remediation, and did not align dynamic approval with canonical runtime object chain. Fix: This document preserves `OrgNode / ApprovalRouteDecision` minimum fields and completes the remediation section, requiring high-risk approval routing results to be traceable back to runtime context or associated requests corresponding to `harness_run_id` / `node_run_id`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger / BudgetReservation / BudgetSettlement`.
