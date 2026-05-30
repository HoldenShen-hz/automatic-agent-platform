# Tenant Isolation Contract

> Scope note:
> The complete specification for shared worker security, tenant boundaries, and organization-level isolation is in `tenant_isolation_and_shared_worker_safety_contract.md`.
> This document only retains the minimal isolation object definitions.

## 1. Scope

Define isolation boundaries for multi-tenant truth, cache, queues, workers, and prompt/knowledge resources.

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

- Any shared worker scenario must carry a tenant fence/policy proof.
- Truth/event/audit association keys must explicitly include tenant semantics.
- Cross-tenant leakage must not occur via session, cache, or prompt fallback.