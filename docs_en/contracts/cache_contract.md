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

- `stableHash` must be generated from normalized input; unsorted objects must not be directly concatenated into keys.
- `tags` are used for batch invalidation by domain, prompt, workflow, or tenant.
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

- Cache entries must not be served after `expiresAt` has passed.
- After `staleAt` is reached, stale-while-revalidate may be entered, but callers must explicitly allow it.
- Prompt, model, policy, domain descriptor, and workflow version changes must trigger tag-level invalidation.
- Sensitive data-carrying cache objects must not be shared across `tenant` / `workspace` boundaries.

## 5. Observability and Constraints

- Must record at least five metric types: `hit`, `miss`, `stale_hit`, `write`, and `eviction`.
- Fill order between L1/L2/L3 must be stable; silent drift where "lower tier hits but upper tier does not fill" is prohibited.
- Cache misses must not change business result semantics; only latency and cost may be affected.

## 6. Testing Requirements

- Unit: key normalization, TTL/stale semantics, tag invalidation, multi-level fill.
- Integration: cross-layer invalidation broadcasting after prompt/model/workflow changes.
- Contract: consistent behavior across tiers for `CacheStore` SPI, especially for null values, expiration, and value fill constraints.
