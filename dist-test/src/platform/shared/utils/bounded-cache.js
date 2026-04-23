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
export class BoundedCache {
    maxEntries;
    cache;
    constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
        this.maxEntries = Math.max(1, Math.trunc(maxEntries));
        this.cache = new Map();
    }
    /**
     * Gets a value from the cache.
     */
    get(key) {
        return this.cache.get(key);
    }
    /**
     * Sets a value in the cache, evicting oldest if at capacity.
     */
    set(key, value) {
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
    has(key) {
        return this.cache.has(key);
    }
    /**
     * Deletes a key from the cache.
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Clears all entries from the cache.
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Returns the number of entries in the cache.
     */
    get size() {
        return this.cache.size;
    }
    /**
     * Returns an iterator over the cache entries.
     */
    entries() {
        return this.cache.entries();
    }
    /**
     * Returns an iterator over the cache values.
     */
    values() {
        return this.cache.values();
    }
    /**
     * Returns an iterator over the cache keys.
     */
    keys() {
        return this.cache.keys();
    }
    /**
     * Returns an iterator over the cache entries.
     */
    [Symbol.iterator]() {
        return this.cache[Symbol.iterator]();
    }
}
//# sourceMappingURL=bounded-cache.js.map