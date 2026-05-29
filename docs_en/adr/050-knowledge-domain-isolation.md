# ADR-050 知识域隔离vs受控共享

- Status：Accepted
- Decision日期：2026-04-20

## Background

不同部门知识需要边界隔离，防止data泄漏，同时supported受控的知识共享。

## Decision

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

| 级别 | Description | 跨域检索 |
|------|------|----------|
| strict | 完全隔离 | 不允许 |
| moderate | 审批后共享 | 需审批 |
| open | 可见但需authorization | 需authorization |

### 知识共享流程

1. 申请共享（指定目标域和用途）
2. 源域审批
3. 目标域确认
4. 审计日志record

### 信任模型

- 部门间信任关系
- 知识来源验证
- 共享历史追踪

## Consequences

优点：

- 严格隔离防止data泄漏
- 受控共享supported业务协作
- 审计追踪确保责任明确

代价：

- 隔离Impact知识复用
- 共享流程增加delay

## 交叉references用

- [ADR-046 组织层iterations模型](./046-organization-hierarchy-model.md)
-