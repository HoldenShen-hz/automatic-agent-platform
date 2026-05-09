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

// OrgTree 级联操作采用 Saga 语义
interface OrgTreeSaga {
  prepare(): Compensatable[];        // 收集所有待执行的级联变更
  commit(): void;                     // 原子性提交所有变更
  compensate(operations: Compensatable[]): Compensatable[];  // 失败时逆向回滚，返回未恢复成功的操作
  audit(): void;                      // 记录完整变更轨迹
}
```

### 层级治理策略（v4.3 OrgNode hierarchy）

> 注意：R5-66 修复 - v4.3 已用 OrgNode hierarchy 取代 CEO/VP 治理层级。

| 层级 | 治理自主权 | 审批链路（OrgNode） |
|------|-----------|-------------------|
| 公司级 | 平台管理 | OrgNode(root)/治理委员会 |
| 事业群级 | 事业群管理 | OrgNode(business_group) |
| 部门级 | 部门管理 | OrgNode(department) |
| 团队级 | 团队管理 | OrgNode(team) |
| 个人级 | 个体管理 | OrgNode(individual) |

### 与租户的关系

- tenant 是顶层隔离单位
- 组织层次在 tenant 内细分
- 跨 tenant 无组织关系

### OrgTree 级联变更补偿语义

组织架构变更（如部门撤销、团队合并、人员转岗）具有级联效应。OrgTreeSaga 保证：

1. **准备阶段**：收集所有受影响的节点、子节点、关联权限、关联审批链路
2. **提交阶段**：原子性执行所有变更
3. **补偿阶段**：任意变更失败时，逆向回滚所有已提交的变更，返回未恢复的操作列表
4. **审计阶段**：记录完整变更轨迹，包括补偿执行结果

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
