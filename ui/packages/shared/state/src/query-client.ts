import { QueryClient } from "@tanstack/react-query";

/**
 * Tiered staleTime strategy per §5.1.2:
 * - Real-time data (health checks, live metrics): 0 (always refetch)
 * - Tasks (task state, execution status): 120_000 (2min)
 * - Approvals (pending approvals): 30_000 (30s)
 * - Config (feature flags, system config): 3_600_000 (1h)
 * - Static (reference data, schemas): 300_000 (5min)
 */
export type CacheTier = "real_time" | "tasks" | "approvals" | "config" | "static";

export const CACHE_TIER_STALE_TIME: Record<CacheTier, number> = {
  real_time: 0,
  tasks: 120_000,
  approvals: 30_000,
  config: 3_600_000,
  static: 300_000,
};

export function createQueryClientFactory() {
  return createTieredQueryClientFactory("tasks");
}

/**
 * Creates a QueryClient with tiered staleTime per §5.1.2.
 * @param defaultTier Default tier for queries without explicit tier annotation
 */
export function createTieredQueryClientFactory(defaultTier: CacheTier = "tasks") {
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
