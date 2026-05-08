# ADR-049 分部门合规策略引擎

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

不同部门（金融、研发、市场）有不同合规要求，平台需要支持部门级合规策略定制。

## 决策

### CompliancePolicy 结构

```typescript
interface CompliancePolicy {
  policy_id: string;
  department_id: string;
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

### 规则类型

| 类型 | 说明 |
|------|------|
| data_retention | 数据保留期 |
| access_control | 访问控制 |
| audit_logging | 审计日志 |
| encryption | 加密要求 |
| data_classification | 数据分类 |

### 策略继承与覆盖

- 子部门继承父部门策略
- 子部门可覆盖父部门策略（更严格）
- 平台级策略不可覆盖

### 合规检查点

- 任务执行前检查
- 任务执行后检查
- 定期扫描检查

## 后果

优点：

- 差异化合规支持业务需求
- 继承机制减少重复配置
- 检查点机制确保合规落地

代价：

- 策略管理复杂度
- 覆盖规则可能造成混乱

## 交叉引用

- [ADR-046 组织层次模型](./046-organization-hierarchy-model.md)
- [平台架构 §23 合规与数据治理](../architecture/00-platform-architecture.md)

## 来源章节

- `§49` 分部门合规策略引擎
