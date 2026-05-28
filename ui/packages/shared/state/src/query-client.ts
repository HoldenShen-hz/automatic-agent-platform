import { RestHttpError } from "@aa/shared-api-client";
import { QueryClient } from "@tanstack/react-query";

export const CACHE_TIER_STALE_TIME = {
  tasks: 300_000,
  approvals: 300_000,
  config: 3_600_000,
} as const;

export type QueryCacheTier = keyof typeof CACHE_TIER_STALE_TIME;

export function createTieredQueryClientFactory(tier: QueryCacheTier) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE_TIER_STALE_TIME[tier],
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => shouldRetryQuery(failureCount, error),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: (failureCount, error) => shouldRetryMutation(failureCount, error),
      },
    },
  });
}

export function createQueryClient() {
  return createTieredQueryClientFactory("tasks");
}

export function createQueryClientFactory() {
  return createQueryClient();
}

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) {
    return false;
  }
  if (error instanceof RestHttpError) {
    return error.status === 429 || error.status >= 500;
  }
  return !(error instanceof DOMException && error.name === "AbortError");
}

function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) {
    return false;
  }
  if (error instanceof RestHttpError) {
    return error.status === 429 || error.status >= 500;
  }
  return !(error instanceof DOMException && error.name === "AbortError");
}
