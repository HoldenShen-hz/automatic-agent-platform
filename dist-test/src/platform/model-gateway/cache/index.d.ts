export interface ModelGatewayCacheEntry<TValue = unknown> {
    cacheKey: string;
    tenantId: string | null;
    model: string;
    routeClass: string;
    value: TValue;
    createdAt: string;
    expiresAt: string | null;
}
export declare class ModelGatewayCacheService<TValue = unknown> {
    private readonly entries;
    buildCacheKey(input: {
        tenantId?: string | null;
        model: string;
        routeClass: string;
        messages: readonly {
            role: string;
            content: string;
        }[];
    }): string;
    put(input: {
        cacheKey: string;
        tenantId?: string | null;
        model: string;
        routeClass: string;
        value: TValue;
        createdAt?: string;
        ttlMs?: number | null;
    }): ModelGatewayCacheEntry<TValue>;
    get(cacheKey: string, now?: string): ModelGatewayCacheEntry<TValue> | null;
    invalidate(cacheKey: string): boolean;
    listEntries(): ModelGatewayCacheEntry<TValue>[];
}
