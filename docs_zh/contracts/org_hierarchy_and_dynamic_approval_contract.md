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

