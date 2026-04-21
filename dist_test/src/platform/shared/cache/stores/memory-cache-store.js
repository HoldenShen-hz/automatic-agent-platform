/**
 * Memory Cache Store
 *
 * L1 in-memory cache with LRU eviction and TTL support.
 * Fastest cache layer, suitable for high-frequency access.
 */
export class MemoryCacheStore {
    entries = new Map();
    head;
    tail;
    maxEntries;
    constructor(maxEntries = 2000) {
        this.maxEntries = maxEntries;
    }
    getBucketKey(namespace, key) {
        return `${namespace}::${key}`;
    }
    removeLru(entry) {
        if (entry.lruPrev !== undefined) {
            // Connect previous to next (may be undefined, which clears the pointer)
            if (entry.lruNext !== undefined) {
                entry.lruPrev.lruNext = entry.lruNext;
            }
            else {
                delete entry.lruPrev.lruNext;
            }
        }
        else {
            this.head = entry.lruNext;
        }
        if (entry.lruNext !== undefined) {
            // Connect next to previous (may be undefined, which clears the pointer)
            if (entry.lruPrev !== undefined) {
                entry.lruNext.lruPrev = entry.lruPrev;
            }
            else {
                delete entry.lruNext.lruPrev;
            }
        }
        else {
            this.tail = entry.lruPrev;
        }
    }
    addToHead(entry) {
        // When assigning to optional property with exactOptionalPropertyTypes,
        // we must assign only the type, not undefined. But we want to "clear" it.
        // Use delete + conditional assignment pattern.
        if (this.head !== undefined) {
            this.head.lruPrev = entry;
            entry.lruNext = this.head;
        }
        else {
            this.head = entry;
        }
        entry.lruPrev = undefined;
        if (this.tail === undefined) {
            this.tail = entry;
        }
    }
    async get(namespace, key) {
        const bucketKey = this.getBucketKey(namespace, key);
        const entry = this.entries.get(bucketKey);
        if (!entry) {
            return { hit: false, value: null, reason: 'not_found' };
        }
        // Check expiration
        if (entry.meta.expiresAt && entry.meta.expiresAt <= Date.now()) {
            this.removeLru(entry);
            this.entries.delete(bucketKey);
            return { hit: false, value: null, reason: 'expired' };
        }
        // Update LRU
        this.removeLru(entry);
        this.addToHead(entry);
        // Update access metadata
        entry.meta.lastAccessedAt = Date.now();
        entry.meta.hitCount += 1;
        return {
            hit: true,
            value: entry.value,
            layer: 'L1',
        };
    }
    async set(namespace, key, value, meta) {
        const bucketKey = this.getBucketKey(namespace, key);
        // Evict oldest if at capacity
        if (!this.entries.has(bucketKey) && this.entries.size >= this.maxEntries) {
            if (this.tail) {
                const tailKey = this.findKeyByEntry(this.tail);
                if (tailKey) {
                    this.entries.delete(tailKey);
                }
                this.removeLru(this.tail);
            }
        }
        const entry = { value, meta };
        this.addToHead(entry);
        this.entries.set(bucketKey, entry);
    }
    findKeyByEntry(entry) {
        for (const [key, e] of this.entries.entries()) {
            if (e === entry)
                return key;
        }
        return undefined;
    }
    async delete(namespace, key) {
        const bucketKey = this.getBucketKey(namespace, key);
        const entry = this.entries.get(bucketKey);
        if (entry) {
            this.removeLru(entry);
        }
        this.entries.delete(bucketKey);
    }
    async invalidateByTag(tag) {
        let count = 0;
        const toDelete = [];
        for (const [bucketKey, entry] of this.entries.entries()) {
            if (entry.meta.tags.includes(tag)) {
                toDelete.push(bucketKey);
            }
        }
        for (const key of toDelete) {
            const entry = this.entries.get(key);
            if (entry) {
                this.removeLru(entry);
            }
            this.entries.delete(key);
            count++;
        }
        return count;
    }
    async invalidateNamespace(namespace) {
        let count = 0;
        const prefix = `${namespace}::`;
        const toDelete = [];
        for (const bucketKey of this.entries.keys()) {
            if (bucketKey.startsWith(prefix)) {
                toDelete.push(bucketKey);
            }
        }
        for (const key of toDelete) {
            const entry = this.entries.get(key);
            if (entry) {
                this.removeLru(entry);
            }
            this.entries.delete(key);
            count++;
        }
        return count;
    }
    async cleanupExpired() {
        let count = 0;
        const now = Date.now();
        const toDelete = [];
        for (const [bucketKey, entry] of this.entries.entries()) {
            if (entry.meta.expiresAt && entry.meta.expiresAt <= now) {
                toDelete.push(bucketKey);
            }
        }
        for (const key of toDelete) {
            const entry = this.entries.get(key);
            if (entry) {
                this.removeLru(entry);
            }
            this.entries.delete(key);
            count++;
        }
        return count;
    }
    /**
     * Returns current entry count (for diagnostics).
     */
    get size() {
        return this.entries.size;
    }
}
//# sourceMappingURL=memory-cache-store.js.map