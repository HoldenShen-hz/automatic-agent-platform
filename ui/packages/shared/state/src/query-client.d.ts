import { QueryClient } from "@tanstack/react-query";
export declare const CACHE_TIER_STALE_TIME: {
    readonly tasks: 300000;
    readonly approvals: 300000;
    readonly config: 3600000;
};
export type QueryCacheTier = keyof typeof CACHE_TIER_STALE_TIME;
export declare function createTieredQueryClientFactory(tier: QueryCacheTier): QueryClient;
export declare function createQueryClient(): QueryClient;
export declare function createQueryClientFactory(): QueryClient;
