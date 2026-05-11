# Tenant Isolation Contract

## 1. Scope

Defines isolation boundaries for multi-tenant truth, cache, queue, worker, and prompt/knowledge resources.

## 2. Core Objects

```typescript
interface TenantIsolationScope {
  tenantId: string;
  resourceType: "run" | "node" | "artifact" | "prompt" | "knowledge" | "queue";
  isolationMode: "strict" | "shared_worker_guarded";
  policyRef: string;
}
```

## 3. Constraints

- Any shared worker scenario must carry tenant fence / policy proof.
- truth/event/audit association keys must explicitly carry tenant semantics.
- Cross-tenant leakage is not allowed through session, cache, or prompt fallback.
