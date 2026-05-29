# Cache Contract

## 1. 范围

本 contract defines `src/platform/shared/cache/` 的 authoritative cache对象、分层storage、失效广播vs测试要求。

相关文档：

- `configuration_layers_and_defaults_contract.md`
- `observability_contract.md`
- `model_gateway_routing_contract.md`

## 2. 核心对象

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

## 3. storage SPI

```typescript
interface CacheStore {
  get<T>(key: CacheKey): Promise<CacheEntry<T> | null>;
  set<T>(entry: CacheEntry<T>): Promise<void>;
  delete(key: CacheKey): Promise<boolean>;
  invalidateByTags(tags: string[]): Promise<number>;
}
```

规则：

- `stableHash` 必须由规范化输入生成，不允许把未via排序的对象directly拼进 key。
- `tags` used for按 domain / prompt / workflow / tenant 批量失效。
- `versionToken` 存在时，消费者必须把其视为强一致边界的一部分。

## 4. 生命cyclevs失效

```typescript
type InvalidationReason =
  | "ttl_expired"
  | "manual_flush"
  | "tag_broadcast"
  | "dependency_changed"
  | "version_rolled";
```

规则：

- `expiresAt` 到期后不得继续命中。
- `staleAt` 到达后可进入 stale-while-revalidate，但call方必须显式允许。
- prompt、model、policy、domain descriptor、workflow version 变化必须触发 tag 级失效。
- 不得跨 `tenant` / `workspace` 共享携带敏感data的cache对象。

## 5. 观测vs约束

- 必须record至少 `hit`、`miss`、`stale_hit`、`write`、`eviction` 五class指标。
- L1/L2/L3 之间的回填顺序必须稳定，禁止“低层命中但高层不回填”的静默漂移。
- cache miss 不得改变业务结果语义，只允许Impactdelayvs成本。

## 6. 测试要求

- unit：key 规范化、TTL/stale 语义、tag 失效、multi-level 回填。
- integration：prompt/model/workflow 变更后触发跨层失效广播。
- contract：不同 tier 对 `CacheStore` SPI 的lines为一致，尤其is空值、过期和值回填约束。
