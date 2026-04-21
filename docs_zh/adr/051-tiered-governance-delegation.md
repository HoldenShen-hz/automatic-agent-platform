# ADR-051 分级治理委托

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

平台管理员不可能管理所有事务，需要将治理权委托给下级组织。

## 决策

### 委托模型

```typescript
interface GovernanceDelegation {
  delegation_id: string;
  delegator_id: string;       // 委托方
  delegate_id: string;         // 受托方
  scope: DelegationScope;
  permissions: Permission[];
  constraints: DelegationConstraint[];
  valid_from: string;
  valid_until?: string;
  revocable: boolean;
}

interface DelegationScope {
  organization_level: OrgLevel;
  resource_types: ResourceType[];
  max_actions_per_day?: number;
}
```

### 委托层级

| 层级 | 可委托权限 |
|------|-----------|
| 平台级 | 全部权限 |
| 事业群级 | 事业群内权限 |
| 部门级 | 部门内权限 |
| 团队级 | 有限权限 |

### 约束条件

| 约束类型 | 说明 |
|----------|------|
| budget_limit | 预算上限 |
| risk_threshold | 风险上限 |
| approval_required | 需上级审批 |
| time_window | 有效时间窗口 |

### 委托审计

- 所有委托操作记录审计日志
- 委托关系变更通知双方
- 定期审查委托有效性

## 后果

优点：

- 分布式治理提高效率
- 约束机制防止权限滥用
- 审计追踪确保合规

代价：

- 委托关系复杂
- 权限回收需要完整流程

## 交叉引用

- [ADR-046 组织层次模型](./046-organization-hierarchy-model.md)
- [ADR-027 安全可靠架构](./027-security-architecture.md)

## 来源章节

- `§51` 分级治理委托
