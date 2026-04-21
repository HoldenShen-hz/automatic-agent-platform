# ADR-050 知识域隔离与受控共享

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

不同部门知识需要边界隔离，防止数据泄漏，同时支持受控的知识共享。

## 决策

### 知识域模型

```typescript
interface KnowledgeDomain {
  domain_id: string;
  name: string;
  owner_department_id: string;
  isolation_level: IsolationLevel;
  sharing_policy: SharingPolicy;
}

type IsolationLevel = 'strict' | 'moderate' | 'open';

interface SharingPolicy {
  allowed_domains: string[];
  requires_approval: boolean;
  audit_sharing: boolean;
}
```

### 隔离级别

| 级别 | 说明 | 跨域检索 |
|------|------|----------|
| strict | 完全隔离 | 不允许 |
| moderate | 审批后共享 | 需审批 |
| open | 可见但需授权 | 需授权 |

### 知识共享流程

1. 申请共享（指定目标域和用途）
2. 源域审批
3. 目标域确认
4. 审计日志记录

### 信任模型

- 部门间信任关系
- 知识来源验证
- 共享历史追踪

## 后果

优点：

- 严格隔离防止数据泄漏
- 受控共享支持业务协作
- 审计追踪确保责任明确

代价：

- 隔离影响知识复用
- 共享流程增加延迟

## 交叉引用

- [ADR-046 组织层次模型](./046-organization-hierarchy-model.md)
-