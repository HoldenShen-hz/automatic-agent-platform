# Federation Contract

## 1. Scope

Defines the boundaries for cross-tenant/cross-region federated queries and capability interconnections.

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

- Federation can only occur between explicitly allowlisted region/tenant pairs.
- Cross-border queries must preserve data residency and de-identification policies.
- Any handoff must record the source, target, and policy proof.
