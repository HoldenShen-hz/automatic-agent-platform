/**
 * Multi-Level Cache Store
 *
 * Coordinates L1, L2, and L3 cache layers with hierarchical lookup
 * and automatic population of upper layers on hits.
 */
export class MultiLevelCacheStore {
    l1;
    l2;
    l3;
    constructor(l1, l2, l3) {
        this.l1 = l1;
        this.l2 = l2;
        this.l3 = l3;
    }
    getStoreForLayer(layer) {
        switch (layer) {
            case 'L1': return this.l1;
            case 'L2': return this.l2;
            case 'L3': return this.l3;
        }
    }
    async get(namespace, key) {
        // Try L1 first
        const l1Result = await this.l1.get(namespace, key);
        if (l1Result.hit) {
            return l1Result;
        }
        // Try L2
        const l2Result = await this.l2.get(namespace, key);
        if (l2Result.hit && l2Result.value !== null) {
            // Populate L1 on L2 hit
            const backfillMeta = {
                scope: "memory",
                tags: [],
                version: "backfill",
                createdAt: Date.now(),
                lastAccessedAt: Date.now(),
                hitCount: 0,
                sizeBytes: 0,
            };
            await this.l1.set(namespace, key, l2Result.value, backfillMeta).catch(() => { });
            return { ...l2Result, layer: 'L2' };
        }
        // Try L3
        const l3Result = await this.l3.get(namespace, key);
        if (l3Result.hit && l3Result.value !== null) {
            // Populate L1 on L3 hit
            const backfillMeta = {
                scope: "persistent",
                tags: [],
                version: "backfill",
                createdAt: Date.now(),
                lastAccessedAt: Date.now(),
                hitCount: 0,
                sizeBytes: 0,
            };
            await this.l1.set(namespace, key, l3Result.value, backfillMeta).catch(() => { });
            return { ...l3Result, layer: 'L3' };
        }
        // All miss
        return {
            hit: false,
            value: null,
            reason: l3Result.reason ?? 'not_found',
        };
    }
    async set(namespace, key, value, meta) {
        switch (meta.scope) {
            case 'memory':
                await this.l1.set(namespace, key, value, meta);
                break;
            case 'session':
                await this.l2.set(namespace, key, value, meta);
                await this.l1.set(namespace, key, value, meta);
                break;
            case 'persistent':
                await this.l3.set(namespace, key, value, meta);
                await this.l2.set(namespace, key, value, meta);
                await this.l1.set(namespace, key, value, meta);
                break;
        }
    }
    async delete(namespace, key) {
        await Promise.all([
            this.l1.delete(namespace, key),
            this.l2.delete(namespace, key),
            this.l3.delete(namespace, key),
        ]);
    }
    async invalidateByTag(tag) {
        const [l1Count] = await Promise.all([
            this.l1.invalidateByTag(tag),
            this.l2.invalidateByTag(tag),
            this.l3.invalidateByTag(tag),
        ]);
        return l1Count;
    }
    async invalidateNamespace(namespace) {
        const [l1Count] = await Promise.all([
            this.l1.invalidateNamespace(namespace),
            this.l2.invalidateNamespace(namespace),
            this.l3.invalidateNamespace(namespace),
        ]);
        return l1Count;
    }
    async cleanupExpired() {
        const [l1, l2, l3] = await Promise.all([
            this.l1.cleanupExpired(),
            this.l2.cleanupExpired(),
            this.l3.cleanupExpired(),
        ]);
        return l1 + l2 + l3;
    }
}
//# sourceMappingURL=multi-level-cache-store.js.map