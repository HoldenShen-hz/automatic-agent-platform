/**
 * Cache Facade
 *
 * Main entry point for cache operations. Provides get/set/getOrCompute
 * with automatic key generation, policy resolution, and metrics collection.
 */

import type { CacheComputeOptions, CacheLookupResult, CacheMeta } from './cache-types.js';
import type { CacheFacade as ICacheFacade } from './cache-facade.js';
import { getPolicyForNamespace } from './cache-policy.js';
import type { CacheStore } from './stores/cache-store.js';
import { CacheKeyFactory } from './cache-key-factory.js';
import { stableStringify } from './utils/stable-stringify.js';
import { CacheMetrics } from './cache-metrics.js';

export class CacheFacade implements ICacheFacade {
  private readonly pendingComputes = new Map<string, Promise<unknown>>();

  constructor(
    private readonly store: CacheStore,
    private readonly metrics = new CacheMetrics(),
  ) {}

  async get<T>(namespace: string, normalizedInput: unknown): Promise<CacheLookupResult<T>> {
    const policy = getPolicyForNamespace(namespace);
    if (!policy.enabled) {
      const result: CacheLookupResult<T> = { hit: false, value: null, reason: 'disabled' };
      this.metrics.record({ namespace, hit: false, reason: 'disabled' });
      return result;
    }

    const key = CacheKeyFactory.create(namespace, policy.version, normalizedInput);
    const result = await this.store.get<T>(namespace, key);
    this.metrics.record({
      namespace,
      hit: result.hit,
      ...(result.layer !== undefined && { layer: result.layer }),
      ...(result.reason !== undefined && { reason: result.reason }),
    });
    return result;
  }

  async set<T>(
    namespace: string,
    normalizedInput: unknown,
    value: T,
    options: CacheComputeOptions = {},
  ): Promise<void> {
    const policy = getPolicyForNamespace(namespace);
    if (!policy.enabled) return;

    const payloadSize = Buffer.byteLength(stableStringify(value), 'utf8');
    if (payloadSize > policy.maxPayloadBytes) return;

    const key = CacheKeyFactory.create(namespace, policy.version, normalizedInput);
    const now = Date.now();

    const meta: CacheMeta = {
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

  async getOrCompute<T>(
    namespace: string,
    normalizedInput: unknown,
    compute: () => Promise<T>,
    options: CacheComputeOptions = {},
  ): Promise<{ value: T; fromCache: boolean }> {
    if (!options.forceBypass) {
      const found = await this.get<T>(namespace, normalizedInput);
      if (found.hit && found.value !== null) {
        return { value: found.value, fromCache: true };
      }
    }

    const policy = getPolicyForNamespace(namespace);
    const key = CacheKeyFactory.create(namespace, policy.version, normalizedInput);

    // Deduplicate concurrent requests for the same key
    const existing = this.pendingComputes.get(key);
    if (existing !== undefined) {
      const result = await existing as Promise<{ value: T; fromCache: boolean }>;
      return { ...result, fromCache: true };
    }

    const computePromise = (async () => {
      const value = await compute();
      await this.set(namespace, normalizedInput, value, options);
      return { value, fromCache: false };
    })();

    this.pendingComputes.set(key, computePromise as Promise<unknown>);
    try {
      const result = await computePromise;
      return result;
    } finally {
      this.pendingComputes.delete(key);
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    return this.store.invalidateByTag(tag);
  }

  async invalidateNamespace(namespace: string): Promise<number> {
    return this.store.invalidateNamespace(namespace);
  }

  getMetricsSnapshot() {
    return this.metrics.snapshot();
  }
}
