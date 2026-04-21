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

### 层级治理策略

| 层级 | 治理自主权 | 审批链路 |
|------|-----------|----------|
| 公司级 | 平台管理 | CEO/治理委员会 |
| 事业群级 | 事业群管理 | VP |
| 部门级 | 部门管理 | 部门负责人 |
| 团队级 | 团队管理 | Team Lead |

### 与租户的关系

- tenant 是顶层隔离单位
- 组织层次在 tenant 内细分
- 跨 tenant 无组织关系

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
