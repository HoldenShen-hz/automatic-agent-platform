/**
 * React hook for mutations with optimistic update support per §5.6.5.
 *
 * Provides:
 * - useMutation with full optimistic update pattern (onMutate → cache patch → rollback on error)
 * - Automatic integration with createOptimisticMutationOptions
 *
 * Usage:
 * ```tsx
 * const queryClient = useQueryClient();
 * const { mutate, status } = useMutation({
 *   client: restClient,
 *   method: "PATCH",
 *   path: (v) => `/tasks/${v.taskId}`,
 *   onMutate: async (variables) => {
 *     const previous = await snapshotCache(queryClient, [["tasks", variables.taskId]]);
 *     await patchCache(queryClient, ["tasks", variables.taskId], (old) => ({
 *       ...old!,
 *       status: variables.status,
 *     }));
 *     return { previousData: previous };
 *   },
 *   onError: (_err, _vars, context) => {
 *     if (context?.previousData) rollbackCache(queryClient, context.previousData);
 *   },
 *   onSettled: () => {
 *     queryClient.invalidateQueries({ queryKey: ["tasks"] });
 *   },
 * });
 *
 * mutate({ taskId: "123", status: "completed" });
 * ```
 */

import { useMutation as useTanStackMutation, type UseMutationOptions, type UseMutationReturnType } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { RESTClient } from "@aa/shared-api-client";
import { createOptimisticMutationOptions, snapshotCache, rollbackCache, patchCache, type SnapshotResult } from "./optimistic-update";

export interface UseMutationContext {
  previousData: SnapshotResult[];
}

export interface UseMutationProps<TData, TError, TVariables> {
  readonly client: RESTClient;
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string | ((variables: TVariables) => string);
  readonly onMutate?: (variables: TVariables, queryClient: QueryClient) => Promise<SnapshotResult[] | SnapshotResult | undefined> | void;
  readonly onError?: (error: TError, variables: TVariables, context?: UseMutationContext) => void | Promise<void>;
  readonly onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables) => void | Promise<void>;
}

/**
 * Creates a UseMutationOptions object for TanStack Query, with optimistic update wiring.
 */
function buildMutationOptions<TData, TError, TVariables>({
  client,
  method,
  path,
  onMutate,
  onError,
  onSettled,
}: UseMutationProps<TData, TError, TVariables>) {
  return createOptimisticMutationOptions<TData, TError, TVariables>({
    method,
    path,
    client,
    onMutate: async (variables) => {
      if (onMutate) {
        return onMutate(variables, {} as QueryClient);
      }
      return undefined;
    },
    onError: (error, variables, context) => {
      if (onError && context?.previousData) {
        onError(error, variables, context as UseMutationContext);
      }
    },
    onSettled,
  });
}

/**
 * Mutation hook with optimistic update support per §5.6.5.
 *
 * @param options - mutation configuration including REST client, method, path, and callbacks
 * @returns TanStack Query mutation result (mutate, status, etc.)
 */
export function useMutation<TData = unknown, TError = unknown, TVariables = unknown>(
  options: UseMutationProps<TData, TError, TVariables>,
): UseMutationReturnType<TData, TError, TVariables, UseMutationContext> {
  const mutationOptions = buildMutationOptions(options);
  return useTanStackMutation<TData, TError, TVariables, UseMutationContext>(mutationOptions);
}

export { snapshotCache, rollbackCache, patchCache };
export type { SnapshotResult } from "./optimistic-update";