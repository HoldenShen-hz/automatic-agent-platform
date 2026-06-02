# Federation Contract

## 1. Scope

Defines the boundaries for cross-tenant / cross-region federated queries and capability interconnection.

## 2. Core Objects

```typescript
interface FederationRequest {
  requestId: string;
  tenantId: string;
  sourceRegion: string;
  targetRegion: string;
  intent: "query" | "search" | "handoff";
  dataResidencyClass: string;
}
```

## 3. Constraints

- Federation can only occur between region / tenant pairs on an explicit allowlist.
- Cross-boundary queries must preserve data residency and redaction policies.
- Every handoff must record the source, target, and policy proof.
