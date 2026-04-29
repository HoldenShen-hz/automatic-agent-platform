import { QueryClient } from "@tanstack/react-query";

/**
 * Tiered staleTime strategy per §5.1.2:
 * - Real-time data (health checks, live metrics): 0 (always refetch)
 * - Dynamic data (user context, session state): 10_000 (10s)
 * - Semi-static (feature flags, config): 60_000 (1min)
 * - Static (reference data, schemas): 300_000 (5min)
 */
export type CacheTier = "real_time" | "dynamic" | "semi_static" | "static";

export const CACHE_TIER_STALE_TIME: Record<CacheTier, number> = {
  real_time: 0,
  dynamic: 10_000,
  semi_static: 60_000,
  static: 300_000,
};

export function createQueryClientFactory() {
  return createTieredQueryClientFactory("dynamic");
}

/**
 * Creates a QueryClient with tiered staleTime per §5.1.2.
 * @param defaultTier Default tier for queries without explicit tier annotation
 */
export function createTieredQueryClientFactory(defaultTier: CacheTier = "dynamic") {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE_TIER_STALE_TIME[defaultTier],
        gcTime: 5 * 60_000,
        retry: 1,
      },
    },
  });
}
