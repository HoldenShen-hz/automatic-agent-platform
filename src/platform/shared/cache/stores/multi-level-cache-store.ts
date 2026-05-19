/**
 * Multi-Level Cache Store
 *
 * Coordinates L1, L2, and L3 cache layers with hierarchical lookup
 * and automatic population of upper layers on hits.
 */

import type { CacheLookupResult, CacheMeta, CacheLayer } from '../cache-types.js';
import type { CacheStore } from './cache-store.js';

export class MultiLevelCacheStore implements CacheStore {
  constructor(
    private readonly l1: CacheStore,
    private readonly l2: CacheStore,
    private readonly l3: CacheStore,
  ) {}

  private getStoreForLayer(layer: CacheLayer): CacheStore {
    switch (layer) {
      case 'L1': return this.l1;
      case 'L2': return this.l2;
      case 'L3': return this.l3;
    }
  }

  private async backfillL1<T>(
    namespace: string,
    key: string,
    result: CacheLookupResult<T>,
  ): Promise<boolean> {
    if (!result.hit || result.value === null || result.meta == null) {
      return false;
    }
    await this.l1.set(namespace, key, result.value, {
      ...result.meta,
      scope: "memory",
    });
    return true;
  }

  private async runAcrossStores<T>(
    operation: string,
    work: (store: CacheStore) => Promise<T>,
    stores: readonly CacheStore[] = [this.l1, this.l2, this.l3],
  ): Promise<T[]> {
    const settled = await Promise.allSettled(stores.map((store) => work(store)));
    const values: T[] = [];
    const failures: Error[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") {
        values.push(result.value);
        continue;
      }
      failures.push(result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, `${operation} failed in one or more cache layers.`);
    }
    return values;
  }

  async get<T>(namespace: string, key: string): Promise<CacheLookupResult<T>> {
    // Try L1 first
    const l1Result = await this.l1.get<T>(namespace, key);
    if (l1Result.hit) {
      return l1Result;
    }

    // Try L2
    const l2Result = await this.l2.get<T>(namespace, key);
    if (l2Result.hit && l2Result.value !== null) {
      try {
        await this.backfillL1(namespace, key, l2Result);
        return { ...l2Result, layer: 'L2' };
      } catch {
        return { ...l2Result, layer: 'L2', backfillFailed: true };
      }
    }

    // Try L3
    const l3Result = await this.l3.get<T>(namespace, key);
    if (l3Result.hit && l3Result.value !== null) {
      try {
        await this.backfillL1(namespace, key, l3Result);
        return { ...l3Result, layer: 'L3' };
      } catch {
        return { ...l3Result, layer: 'L3', backfillFailed: true };
      }
    }

    // All miss
    return {
      hit: false,
      value: null,
      reason: l3Result.reason ?? 'not_found',
    };
  }

  async set<T>(namespace: string, key: string, value: T, meta: CacheMeta): Promise<void> {
    switch (meta.scope) {
      case 'memory':
        await this.l1.set(namespace, key, value, meta);
        break;
      case 'session':
        await this.runAcrossStores("cache set", (store) => store.set(namespace, key, value, meta), [this.l1, this.l2]);
        break;
      case 'persistent':
        await this.runAcrossStores("cache set", (store) => store.set(namespace, key, value, meta));
        break;
    }
  }

  async delete(namespace: string, key: string): Promise<void> {
    await this.runAcrossStores("cache delete", (store) => store.delete(namespace, key));
  }

  async invalidateByTag(tag: string): Promise<number> {
    const counts = await this.runAcrossStores("cache invalidateByTag", (store) => store.invalidateByTag(tag));
    return counts.reduce((sum, count) => sum + count, 0);
  }

  async invalidateNamespace(namespace: string): Promise<number> {
    const counts = await this.runAcrossStores("cache invalidateNamespace", (store) => store.invalidateNamespace(namespace));
    return counts.reduce((sum, count) => sum + count, 0);
  }

  async cleanupExpired(): Promise<number> {
    const counts = await this.runAcrossStores("cache cleanupExpired", (store) => store.cleanupExpired());
    return counts.reduce((sum, count) => sum + count, 0);
  }
}
