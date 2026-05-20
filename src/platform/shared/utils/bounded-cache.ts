/**
 * @fileoverview Bounded Cache - Map wrapper with capacity enforcement.
 *
 * Supports bounded storage with optional TTL expiry, FIFO/LRU eviction, and basic hit/miss stats.
 */

const DEFAULT_MAX_ENTRIES = 100;

export interface BoundedCacheOptions {
  maxEntries?: number;
  ttlMs?: number | null;
  evictionPolicy?: "fifo" | "lru";
  touchOnGet?: boolean;
}

export interface BoundedCacheStats {
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
}

interface CacheEntry<V> {
  value: V;
  expiresAt: number | null;
}

/**
 * Creates a bounded cache with automatic eviction.
 *
 * @typeParam K - Key type
 * @typeParam V - Value type
 */
export class BoundedCache<K, V> implements Iterable<[K, V]> {
  private readonly maxEntries: number;
  private readonly cache: Map<K, CacheEntry<V>>;
  private readonly ttlMs: number | null;
  private readonly evictionPolicy: "fifo" | "lru";
  private readonly touchOnGet: boolean;
  private readonly stats: BoundedCacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
  };

  public constructor(config: number | BoundedCacheOptions = DEFAULT_MAX_ENTRIES) {
    const options = typeof config === "number"
      ? { maxEntries: config }
      : config;
    this.maxEntries = Math.max(1, Math.trunc(options.maxEntries ?? DEFAULT_MAX_ENTRIES));
    this.cache = new Map<K, CacheEntry<V>>();
    this.ttlMs = options.ttlMs == null ? null : Math.max(1, Math.trunc(options.ttlMs));
    this.evictionPolicy = options.evictionPolicy ?? "fifo";
    this.touchOnGet = options.touchOnGet ?? this.evictionPolicy === "lru";
  }

  /**
   * Gets a value from the cache.
   */
  public get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (entry == null) {
      this.stats.misses++;
      return undefined;
    }
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.expirations++;
      return undefined;
    }
    if (this.touchOnGet) {
      this.touchEntry(key, entry);
    }
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Sets a value in the cache, evicting oldest if at capacity.
   */
  public set(key: K, value: V): void {
    this.purgeExpired();
    const existing = this.cache.get(key);
    if (existing != null) {
      this.cache.delete(key);
    }
    if (this.cache.size >= this.maxEntries) {
      const evictedKey = this.cache.keys().next().value;
      if (evictedKey !== undefined) {
        this.cache.delete(evictedKey);
        this.stats.evictions++;
      }
    }
    this.cache.set(key, {
      value,
      expiresAt: this.ttlMs == null ? null : Date.now() + this.ttlMs,
    });
  }

  /**
   * Checks if a key exists in the cache.
   */
  public has(key: K): boolean {
    const entry = this.cache.get(key);
    if (entry == null) {
      return false;
    }
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.expirations++;
      return false;
    }
    return true;
  }

  /**
   * Deletes a key from the cache.
   */
  public delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clears all entries from the cache.
   */
  public clear(): void {
    this.cache.clear();
  }

  public purgeExpired(): number {
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isExpired(entry)) {
        continue;
      }
      this.cache.delete(key);
      removed++;
    }
    this.stats.expirations += removed;
    return removed;
  }

  public getStats(): Readonly<BoundedCacheStats> {
    return { ...this.stats };
  }

  /**
   * Returns the number of entries in the cache.
   */
  public get size(): number {
    this.purgeExpired();
    return this.cache.size;
  }

  /**
   * Returns an iterator over the cache entries.
   */
  public entries(): IterableIterator<[K, V]> {
    this.purgeExpired();
    return this.entryIterator();
  }

  /**
   * Returns an iterator over the cache values.
   */
  public values(): IterableIterator<V> {
    this.purgeExpired();
    return this.valueIterator();
  }

  /**
   * Returns an iterator over the cache keys.
   */
  public keys(): IterableIterator<K> {
    this.purgeExpired();
    return this.cache.keys();
  }

  /**
   * Returns an iterator over the cache entries.
   */
  public [Symbol.iterator](): Iterator<[K, V]> {
    return this.entries();
  }

  private isExpired(entry: CacheEntry<V>): boolean {
    return entry.expiresAt != null && entry.expiresAt <= Date.now();
  }

  private touchEntry(key: K, entry: CacheEntry<V>): void {
    if (this.evictionPolicy !== "lru") {
      return;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
  }

  private *entryIterator(): IterableIterator<[K, V]> {
    for (const [key, entry] of this.cache.entries()) {
      yield [key, entry.value];
    }
  }

  private *valueIterator(): IterableIterator<V> {
    for (const entry of this.cache.values()) {
      yield entry.value;
    }
  }
}
