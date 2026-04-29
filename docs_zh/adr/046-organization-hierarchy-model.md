# ADR-046 组织层次模型

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

企业存在事业群→部门→团队的深层组织层次，平台需要能表达这种层级关系，支持分级治理。

## 决策

### 组织层级结构

```typescript
interface OrganizationHierarchy {
  root: OrgNode;           // 根节点（公司）
  business_groups: OrgNode[];  // 事业群
  departments: OrgNode[];     // 部门
  teams: OrgNode[];           // 团队
  individuals: OrgNode[];     // 个人
}

interface OrgNode {
  node_id: string;
  name: string;
  type: OrgNodeType;
  parent_id?: string;
  children?: string[];
  metadata: OrgMetadata;
}
```

### 层级治理策略（OrgNode 层次，v4.3 §46-§51）

| 层级 | 治理自主权 | 审批链路 |
|------|-----------|----------|
| 根节点（公司级） | 平台管理 | OrgNode 治理链 |
| 事业群级 | 事业群管理 | OrgNode 审批路由 |
| 部门级 | 部门管理 | OrgNode 审批路由 |
| 团队级 | 团队管理 | OrgNode 审批路由 |
| 个人级 | 个人管理 | OrgNode 审批路由 |

注：v4.3 以 OrgNode 层次替代 CEO/VP 命名体系，审批链路通过 ApprovalFlow + OrgNode hierarchy 动态路由。

### 与租户的关系

- tenant 是顶层隔离单位
- 组织层次在 tenant 内细分
- 跨 tenant 无组织关系

### OrgTree 级联变更（§2.4 Saga 语义）

OrgTree 变更（部门合并、团队拆分、人员转岗）须遵循四段 Saga 语义：

| 阶段 | 说明 |
|------|------|
| prepare | 验证变更可行性，生成影响分析，锁定受影响的子节点 |
| commit | 执行组织结构变更，更新所有关联的审批链路和权限 |
| compensate | 若变更失败则回滚至原组织结构，恢复受影响节点的原始状态 |
| audit | 记录变更事件，生成变更报告，通知相关干系人 |

注：Saga 确保 OrgTree 级联变更具备幂等性和补偿能力，防止中间状态导致组织结构与权限系统不一致。

## 后果

优点：

- 层级模型匹配企业实际
- 分级治理提高管理效率
- 审批链路清晰

代价：

- 层级维护复杂度
- 跨层级协作需要额外设计

## 交叉引用

- [ADR-002 事业部系统](./002-division-system.md)
- [ADR-047 组织架构审批路由](./047-organization-approval-routing.md)

## 来源章节

- `§46` 组织层次模型
