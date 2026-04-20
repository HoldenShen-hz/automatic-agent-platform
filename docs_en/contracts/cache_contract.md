# Cache Contract

## 1. Scope

This contract defines the authoritative cache objects, tiered storage, invalidation broadcasting, and testing requirements for `src/platform/shared/cache/`.

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

- `stableHash` must be generated from normalized input; unsorted objects must not be concatenated directly into a key.
- `tags` are used for bulk invalidation by domain / prompt / workflow / tenant.
- When `versionToken` is present, consumers must treat it as part of a strong consistency boundary.

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

- Entries must not be served after `expiresAt` has passed.
- Upon reaching `staleAt`, entries may enter stale-while-revalidate, but callers must explicitly opt in.
- Changes to prompt, model, policy, domain descriptor, or workflow version must trigger tag-level invalidation.
- Cache objects carrying sensitive data must not be shared across `tenant` / `workspace` boundaries.

## 5. Observability and Constraints

- At minimum five metrics must be recorded: `hit`, `miss`, `stale_hit`, `write`, `eviction`.
- The fill order between L1/L2/L3 must be stable; silent drift where a lower tier is hit but the upper tier is not backfilled is prohibited.
- A cache miss must not alter business result semantics; it may only affect latency and cost.

## 6. Testing Requirements

- unit: key normalization, TTL/stale semantics, tag invalidation, multi-level backfill.
- integration: cross-tier invalidation broadcast triggered by prompt/model/workflow changes.
- contract: different tiers must behave consistently with respect to the `CacheStore` SPI, especially for null values, expiration, and value backfill constraints.