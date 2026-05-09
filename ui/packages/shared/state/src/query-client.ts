import { QueryClient } from "@tanstack/react-query";

export const CACHE_TIER_STALE_TIME = {
  tasks: 120_000,
  approvals: 30_000,
  config: 3_600_000,
} as const;

export type QueryCacheTier = keyof typeof CACHE_TIER_STALE_TIME;

export function createTieredQueryClientFactory(tier: QueryCacheTier) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE_TIER_STALE_TIME[tier],
        gcTime: 5 * 60_000,
        retry: 3,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 2,
      },
    },
  });
}

export function createQueryClientFactory() {
  return createTieredQueryClientFactory("tasks");
}
