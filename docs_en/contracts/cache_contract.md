# Cache Contract

## 1. Scope

This contract defines the authoritative cache objects, tiered storage, invalidation broadcast, and test requirements for `src/platform/shared/cache/`.

Related Documents:

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

- `stableHash` must be generated from normalized input; unsorted objects must not be directly拼进 key.
- `tags` are used for batch invalidation by domain / prompt / workflow / tenant.
- When `versionToken` exists, consumers must treat it as part of a strong consistency boundary.

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

- Must not continue to hit after `expiresAt` expires.
- After `staleAt` arrives, can enter stale-while-revalidate, but caller must explicitly allow.
- Prompt, model, policy, domain descriptor, workflow version changes must trigger tag-level invalidation.
- Must not share cache objects carrying sensitive data across `tenant` / `workspace`.

## 5. Observability and Constraints

- Must record at least five types of metrics: `hit`, `miss`, `stale_hit`, `write`, `eviction`.
- Fill-back order between L1/L2/L3 must be stable; "lower layer hit but higher layer not fill-back" silent drift is prohibited.
- Cache miss must not change business result semantics; only affects latency and cost.

## 6. Test Requirements

- unit: key normalization, TTL/stale semantics, tag invalidation, multi-level fill-back.
- integration: prompt/model/workflow changes trigger cross-layer invalidation broadcast.
- contract: different tiers must have consistent behavior for `CacheStore` SPI, especially empty value, expiration, and value fill-back constraints.
