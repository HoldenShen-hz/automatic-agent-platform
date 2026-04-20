/**
 * @fileoverview Bounded Cache - Map wrapper with capacity enforcement.
 *
 * Provides a simple bounded cache that evicts the oldest entry when capacity is exceeded.
 * Uses FIFO (first-in-first-out) eviction policy - the simplest approach that prevents
 * unbounded memory growth.
 */

const DEFAULT_MAX_ENTRIES = 100;

/**
 * Creates a bounded cache with automatic eviction.
 *
 * @typeParam K - Key type
 * @typeParam V - Value type
 */
export class BoundedCache<K, V> implements Iterable<[K, V]> {
  private readonly maxEntries: number;
  private readonly cache: Map<K, V>;

  public constructor(maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = Math.max(1, Math.trunc(maxEntries));
    this.cache = new Map<K, V>();
  }

  /**
   * Gets a value from the cache.
   */
  public get(key: K): V | undefined {
    return this.cache.get(key);
  }

  /**
   * Sets a value in the cache, evicting oldest if at capacity.
   */
  public set(key: K, value: V): void {
    // If key exists, delete it first so it moves to end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, value);
  }

  /**
   * Checks if a key exists in the cache.
   */
  public has(key: K): boolean {
    return this.cache.has(key);
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

  /**
   * Returns the number of entries in the cache.
   */
  public get size(): number {
    return this.cache.size;
  }

  /**
   * Returns an iterator over the cache entries.
   */
  public entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }

  /**
   * Returns an iterator over the cache values.
   */
  public values(): IterableIterator<V> {
    return this.cache.values();
  }

  /**
   * Returns an iterator over the cache keys.
   */
  public keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  /**
   * Returns an iterator over the cache entries.
   */
  public [Symbol.iterator](): Iterator<[K, V]> {
    return this.cache[Symbol.iterator]();
  }
}
