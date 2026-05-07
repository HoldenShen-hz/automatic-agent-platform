# Tenant Isolation Contract

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
