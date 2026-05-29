# Tenant Isolation Contract

> Scope note:
> shared worker 安全、租户边界与组织级隔离的完整规范以 `tenant_isolation_and_shared_worker_safety_contract.md` 为准。
> 本文仅保留最小隔离对象定义。

## 1. 范围

定义多租户 truth、缓存、队列、worker 与 prompt/knowledge 资源的隔离边界。

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
- 不允许通过 session、cache 或 prompt fallback 发生跨租户泄漏。
