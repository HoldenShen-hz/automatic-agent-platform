# Cache Contract

## 1. Scope

This contract defines the authoritative cache objects, layered storage, invalidation broadcast, and testing requirements for `src/platform/shared/cache/`.

Related documents:

- `configuration_layers_and_defaults_contract.md`
- `observability_contract.md`
- `model_gateway_routing_contract.md`

## 2. Core Objects

```typescript
type CacheTier = "l1_memory" | "l2_sqlite" | "l3_redis";

interface CacheKey {
  namespace: string;
  scope: "global" | "tenant" | "workspace" | "session";
  stableHash: string;
  tags: string[];
}

interface CacheEntry<T = unknown> {
  key: CacheKey;
  value: T;
  tier: CacheTier;
  createdAt: string;
  expiresAt: string | null;
  staleAt: string | null;
  versionToken: string | null;
}
```

## 3. Storage SPI

```typescript
interface CacheStore {
  get<T>(key: CacheKey): Promise<CacheEntry<T> | null>;
  set<T>(entry: CacheEntry<T>): Promise<void>;
  delete(key: CacheKey): Promise<boolean>;
  invalidateByTags(tags: string[]): Promise<number>;
}
```

Rules:

- `stableHash` must be generated from normalized input; unsorted objects must not be directly concatenated into key.
- `tags` are used for batch invalidation by domain / prompt / workflow / tenant.
- When `versionToken` exists, consumers must treat it as part of the strong consistency boundary.

## 4. Lifecycle and Invalidation

```typescript
type InvalidationReason =
  | "ttl_expired"
  | "manual_flush"
  | "tag_broadcast"
  | "dependency_changed"
  | "version_rolled";
```

Rules:

- After `expiresAt` expires, it must not continue to hit.
- When `staleAt` is reached, it can enter stale-while-revalidate, but callers must explicitly allow it.
- Changes in prompt, model, policy, domain descriptor, or workflow version must trigger tag-level invalidation.
- Cache objects carrying sensitive data must not be shared across `tenant` / `workspace`.

## 5. Observability and Constraints

- At least `hit`, `miss`, `stale_hit`, `write`, `eviction` five types of metrics must be recorded.
- Fill order between L1/L2/L3 must be stable; "low layer hits but high layer does not refill" silent drift is prohibited.
- Cache miss must not change business result semantics; it can only affect latency and cost.

## 6. Testing Requirements

- unit: key normalization, TTL/stale semantics, tag invalidation, multi-level fill.
- integration: prompt/model/workflow change triggers cross-layer invalidation broadcast.
- contract: different tiers' behavior on `CacheStore` SPI must be consistent, especially for null values, expiration, and value fill constraints.