/**
 * Cache Facade
 *
 * Main entry point for cache operations. Provides get/set/getOrCompute
 * with automatic key generation, policy resolution, and metrics collection.
 */
import { getPolicyForNamespace } from './cache-policy.js';
import { CacheKeyFactory } from './cache-key-factory.js';
import { stableStringify } from './utils/stable-stringify.js';
import { CacheMetrics } from './cache-metrics.js';
export class CacheFacade {
    store;
    metrics;
    pendingComputes = new Map();
    constructor(store, metrics = new CacheMetrics()) {
        this.store = store;
        this.metrics = metrics;
    }
    async get(namespace, normalizedInput) {
        const policy = getPolicyForNamespace(namespace);
        if (!policy.enabled) {
            const result = { hit: false, value: null, reason: 'disabled' };
            this.metrics.record({ namespace, hit: false, reason: 'disabled' });
            return result;
        }
        const key = CacheKeyFactory.create(namespace, policy.version, normalizedInput);
        const result = await this.store.get(namespace, key);
        this.metrics.record({
            namespace,
            hit: result.hit,
            ...(result.layer !== undefined && { layer: result.layer }),
            ...(result.reason !== undefined && { reason: result.reason }),
        });
        return result;
    }
    async set(namespace, normalizedInput, value, options = {}) {
        const policy = getPolicyForNamespace(namespace);
        if (!policy.enabled)
            return;
        const payloadSize = Buffer.byteLength(stableStringify(value), 'utf8');
        if (payloadSize > policy.maxPayloadBytes)
            return;
        const key = CacheKeyFactory.create(namespace, policy.version, normalizedInput);
        const now = Date.now();
        const meta = {
            scope: policy.scope,
            tags: options.tags ?? [],
            version: policy.version,
            createdAt: now,
            ...(policy.ttlMs && { expiresAt: now + policy.ttlMs }),
            lastAccessedAt: now,
            hitCount: 0,
            sizeBytes: payloadSize,
        };
        if (options.contentType) {
            meta.contentType = options.contentType;
        }
        await this.store.set(namespace, key, value, meta);
        this.metrics.record({ namespace, hit: false });
    }
    async getOrCompute(namespace, normalizedInput, compute, options = {}) {
        if (!options.forceBypass) {
            const found = await this.get(namespace, normalizedInput);
            if (found.hit && found.value !== null) {
                return { value: found.value, fromCache: true };
            }
        }
        const policy = getPolicyForNamespace(namespace);
        const key = CacheKeyFactory.create(namespace, policy.version, normalizedInput);
        // Deduplicate concurrent requests for the same key
        const existing = this.pendingComputes.get(key);
        if (existing !== undefined) {
            const result = await existing;
            return { ...result, fromCache: true };
        }
        const computePromise = (async () => {
            const value = await compute();
            await this.set(namespace, normalizedInput, value, options);
            return { value, fromCache: false };
        })();
        this.pendingComputes.set(key, computePromise);
        try {
            const result = await computePromise;
            return result;
        }
        finally {
            this.pendingComputes.delete(key);
        }
    }
    async invalidateByTag(tag) {
        return this.store.invalidateByTag(tag);
    }
    async invalidateNamespace(namespace) {
        return this.store.invalidateNamespace(namespace);
    }
    getMetricsSnapshot() {
        return this.metrics.snapshot();
    }
}
//# sourceMappingURL=cache-facade.js.map