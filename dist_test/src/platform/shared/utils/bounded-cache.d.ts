/**
 * @fileoverview Bounded Cache - Map wrapper with capacity enforcement.
 *
 * Provides a simple bounded cache that evicts the oldest entry when capacity is exceeded.
 * Uses FIFO (first-in-first-out) eviction policy - the simplest approach that prevents
 * unbounded memory growth.
 */
/**
 * Creates a bounded cache with automatic eviction.
 *
 * @typeParam K - Key type
 * @typeParam V - Value type
 */
export declare class BoundedCache<K, V> implements Iterable<[K, V]> {
    private readonly maxEntries;
    private readonly cache;
    constructor(maxEntries?: number);
    /**
     * Gets a value from the cache.
     */
    get(key: K): V | undefined;
    /**
     * Sets a value in the cache, evicting oldest if at capacity.
     */
    set(key: K, value: V): void;
    /**
     * Checks if a key exists in the cache.
     */
    has(key: K): boolean;
    /**
     * Deletes a key from the cache.
     */
    delete(key: K): boolean;
    /**
     * Clears all entries from the cache.
     */
    clear(): void;
    /**
     * Returns the number of entries in the cache.
     */
    get size(): number;
    /**
     * Returns an iterator over the cache entries.
     */
    entries(): IterableIterator<[K, V]>;
    /**
     * Returns an iterator over the cache values.
     */
    values(): IterableIterator<V>;
    /**
     * Returns an iterator over the cache keys.
     */
    keys(): IterableIterator<K>;
    /**
     * Returns an iterator over the cache entries.
     */
    [Symbol.iterator](): Iterator<[K, V]>;
}
