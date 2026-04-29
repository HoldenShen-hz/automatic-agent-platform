/**
 * Optimistic update utilities per §5.6.5.
 *
 * Provides snapshot/rollback helpers for TanStack Query mutations:
 *   - snapshot: captures current cache state before mutation
 *   - rollback: restores cache to snapshot on error
 *   - patch: applies optimistic update to cache
 *
 * Usage:
 * ```ts
 * const mutation = useMutation({
 *   ...createMutationOptions({
 *     client,
 *     method: "PATCH",
 *     path: (v) => `/tasks/${v.taskId}`,
 *     onMutate: async (variables) => {
 *       const previousData = await snapshot(queriesClient, ["tasks", variables.taskId]);
 *       await patch(queriesClient, ["tasks", variables.taskId], (old) => ({ ...old, status: variables.status }));
 *       return { previousData };
 *     },
 *     onError: (_err, _vars, context) => {
 *       if (context?.previousData !== undefined) {
 *         rollback(queriesClient, ["tasks", variables.taskId], context.previousData);
 *       }
 *     },
 *     onSettled: () => {
 *       queriesClient.invalidateQueries({ queryKey: ["tasks"] });
 *     },
 *   }),
 * });
 * ```
 */

import type { QueryClient } from "@tanstack/react-query";
import type { RESTClient } from "@aa/shared-api-client";

export interface SnapshotResult {
  readonly queryKey: readonly unknown[];
  readonly data: unknown;
}

export interface MutationOptions<TData, TError, TVariables> {
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string | ((variables: TVariables) => string);
  readonly client: RESTClient;
  readonly onMutate?: (variables: TVariables) => Promise<SnapshotResult[] | SnapshotResult | undefined> | void;
  readonly onError?: (error: TError, variables: TVariables, context?: { previousData: SnapshotResult[] }) => void | Promise<void>;
  readonly onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables) => void | Promise<void>;
}

/**
 * Captures current cache state for one or more query keys.
 */
export async function snapshotCache(
  queryClient: QueryClient,
  queryKeys: readonly unknown[][],
): Promise<SnapshotResult[]> {
  return queryKeys.map((queryKey) => {
    const query = queryClient.getQueryData(queryKey);
    return { queryKey, data: query };
  });
}

/**
 * Rolls back cache to previously snapshotted state.
 */
export function rollbackCache(
  queryClient: QueryClient,
  snapshots: SnapshotResult[],
): void {
  for (const { queryKey, data } of snapshots) {
    if (data === undefined) {
      queryClient.removeQueries({ queryKey });
    } else {
      queryClient.setQueryData(queryKey, data);
    }
  }
}

/**
 * Applies an optimistic patch to a single query key.
 * The updater function receives the current data and returns the patched data.
 */
export async function patchCache<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  updater: (current: T | undefined) => T,
): Promise<void> {
  await queryClient.cancelQueries({ queryKey });
  queryClient.setQueryData<T>(queryKey, updater(queryClient.getQueryData<T>(queryKey)));
}

/**
 * Creates mutation options that implement the optimistic update pattern.
 *
 * The caller provides onMutate (which does snapshot + patch),
 * onError (which does rollback), and onSettled (which invalidates).
 * This function wires up the REST call and context passing.
 */
export function createOptimisticMutationOptions<TData, TError, TVariables>({
  method,
  path,
  client,
  onMutate,
  onError,
  onSettled,
}: MutationOptions<TData, TError, TVariables>) {
  return {
    mutationFn: async (variables: TVariables) => {
      const resolvedPath = typeof path === "function" ? path(variables) : path;
      switch (method) {
        case "POST":
          return client.post<TData>(resolvedPath, variables);
        case "PUT":
          return client.put<TData>(resolvedPath, variables);
        case "PATCH":
          return client.patch<TData>(resolvedPath, variables);
        case "DELETE":
          return client.delete<TData>(resolvedPath);
      }
    },
    onMutate: async (variables: TVariables) => {
      if (onMutate) {
        return { previousData: await onMutate(variables) };
      }
      return undefined;
    },
    onError: (error: TError, variables: TVariables, context: { previousData: SnapshotResult[] } | undefined) => {
      if (onError && context?.previousData) {
        onError(error, variables, context);
      }
    },
    onSettled: async (data: TData | undefined, error: TError | null, variables: TVariables) => {
      if (onSettled) {
        await onSettled(data, error, variables);
      }
    },
  };
}
