# Org Hierarchy And Dynamic Approval Contract

## 1. 范围

本 contract 定义 `§46-§47` 与 `§49` 的组织模型、动态审批与部门级合规继承。

## 2. Canonical 对象

- `OrgNode`
- `OrgHierarchySnapshot`
- `ApprovalRouteRequest`
- `ApprovalRouteDecision`
- `ApprovalLimitMatrix`
- `CompliancePolicyBinding`

## 3. `OrgNode` 最小字段

- `org_node_id`
- `node_type`: `enterprise | business_unit | department | team | seat`
- `display_name`
- `parent_node_id?`
- `effective_policies`
- `status`

规则：

- 组织树必须无环。
- seat / user 节点只能挂在 team 或 department 下。

## 4. 动态审批路由

`ApprovalRouteDecision` 最小字段：

- `route_id`
- `matched_org_node_id`
- `approver_chain`
- `limit_rule_id`
- `escalation_rule_id?`
- `delegation_applied`

路由输入至少包括：

- requester
- org node
- risk level
- amount / impact
- resource scope

## 5. 继承与覆写

- 审批额度与合规策略默认向下继承。
- 只有在上级允许的边界内，下级才能收紧或局部覆写。
- 放宽限制必须经过上级授权。

## 6. 测试要求

- unit：组织树、路由匹配、限额矩阵
- integration：审批请求跨组织路由与升级
- contract：无组织归属的高风险请求不得自动路由为通过

## v4.3 Contract Remediation

- T-45B: 本文早期版本仅冻结组织树和审批路由最小对象，没有补 v4.3 remediation，也没有把动态审批与 canonical runtime 对象链对齐。修复：本文保留 `OrgNode / ApprovalRouteDecision` 最小字段，并补齐 remediation 段，要求高风险审批路由结果必须能回链到 `harness_run_id` / `node_run_id` 对应的运行时上下文或关联请求。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger / BudgetReservation / BudgetSettlement`。
