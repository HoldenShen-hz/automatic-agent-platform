# Tenant Isolation Contract

> Scope note:
> shared worker security、租户边界vs组织级隔离的完整规范以 `tenant_isolation_and_shared_worker_safety_contract.md` 为准。
> 本文only保留最小隔离对象defines。

## 1. 范围

defines多租户 truth、cache、队列、worker vs prompt/knowledge 资源的隔离边界。

## 2. 核心对象

```typescript
interface TenantIsolationScope {
  tenantId: string;
  resourceType: "run" | "node" | "artifact" | "prompt" | "knowledge" | "queue";
  isolationMode: "strict" | "shared_worker_guarded";
  policyRef: string;
}
```

## 3. 约束

- 任何共享 worker 场景都必须携带 tenant fence / policy proof。
- truth/event/audit 关联键必须显式带 tenant 语义。
- 不允许via session、cache 或 prompt fallback 发生cross-tenant leak。
