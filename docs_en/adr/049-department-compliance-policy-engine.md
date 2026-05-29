# ADR-049 分部门合规策略references擎

- Status：Accepted
- Decision日期：2026-04-20

## Background

不同部门（金融、研发、市场）有不同合规要求，平台需要supported部门级合规策略定制。

## Decision

### CompliancePolicy 结构

```typescript
interface CompliancePolicy {
  policy_id: string;
  org_node_id: string;
  rules: ComplianceRule[];
  enforced: boolean;
  version: string;
}

interface ComplianceRule {
  rule_id: string;
  name: string;
  description: string;
  condition: string;
  action: ComplianceAction;
  severity: 'warning' | 'error' | 'block';
}
```

### 规则class型

| class型 | Description |
|------|------|
| data_retention | data保留期 |
| access_control | 访问控制 |
| audit_logging | 审计日志 |
| encryption | encryption要求 |
| data_classification | data分class |

### 策略继承vs覆盖

- 子部门继承父部门策略
- 子部门可覆盖父部门策略（更严格）
- 平台级策略不可覆盖
- `org_node_id` 必须指向 `OrgNodeType.department` 节点，不再单独references入 `department_id` 命名分支

### 合规检查点

- 任务执lines前检查
- 任务执lines后检查
- 定期扫描检查

## Consequences

优点：

- 差异化合规supported业务需求
- 继承机制减少repeatsconfigure
- 检查点机制确保合规落地

代价：

- 策略manage复杂度
- 覆盖规则可能造成混乱

## 交叉references用

- [ADR-046 组织层iterations模型](./046-organization-hierarchy-model.md)
- [平台Architecture §23 合规vsdata治理](../architecture/00-platform-architecture.md)

## 来源章节

- `§49` 分部门合规策略references擎
