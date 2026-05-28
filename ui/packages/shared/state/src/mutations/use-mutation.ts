/**
 * React hook for mutations with optimistic update support per §5.6.5.
 *
 * Provides:
 * - useMutation hook with full optimistic update pattern (onMutate -> cache patch -> rollback on error)
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

import { useMutation as useTanStackMutation, useQueryClient, type UseMutationOptions, type UseMutationResult } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { RESTClient } from "@aa/shared-api-client";
import { snapshotCache, rollbackCache, patchCache, type SnapshotResult } from "./optimistic-update";

export interface UseMutationContext {
  previousData: SnapshotResult[];
}

export interface UseMutationProps<TData, TError, TVariables> {
  readonly client: RESTClient;
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string | ((variables: TVariables) => string);
  readonly body?: unknown | ((variables: TVariables) => unknown);
  readonly onMutate?: (variables: TVariables, queryClient: QueryClient) => Promise<SnapshotResult[] | SnapshotResult | undefined>;
  readonly onError?: (error: TError, variables: TVariables, context?: UseMutationContext) => void | Promise<void>;
  readonly onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables) => void | Promise<void>;
}

function buildMutationOptions<TData, TError, TVariables>(
  props: UseMutationProps<TData, TError, TVariables>,
  queryClient: QueryClient,
): UseMutationOptions<TData, TError, TVariables, UseMutationContext> {
  const { client, method, path, body, onMutate, onError, onSettled } = props;

  const baseMutationFn = async (variables: TVariables) => {
    const resolvedPath = typeof path === "function" ? path(variables) : path;
    const resolvedBody = resolveMutationBody(variables, resolvedPath, body);
    switch (method) {
      case "POST":
        return client.post<TData>(resolvedPath, resolvedBody);
      case "PUT":
        return client.put<TData>(resolvedPath, resolvedBody);
      case "PATCH":
        return client.patch<TData>(resolvedPath, resolvedBody);
      case "DELETE":
        return client.delete<TData>(resolvedPath);
    }
  };

  // Use type assertion to handle exactOptionalPropertyTypes correctly
  // The key insight: with exactOptionalPropertyTypes, optional properties must be
  // omitted (not set to undefined) when they are not provided
  const options: UseMutationOptions<TData, TError, TVariables, UseMutationContext> = {
    mutationFn: baseMutationFn,
  } as UseMutationOptions<TData, TError, TVariables, UseMutationContext>;

  if (onMutate) {
    options.onMutate = async (variables: TVariables) => {
      const previousData = await onMutate(variables, queryClient);
      return { previousData: normalizeSnapshots(previousData) };
    };
  }

  if (onError) {
    options.onError = (error: TError, variables: TVariables, context?: { previousData: SnapshotResult[] }) => {
      onError(error, variables, context as UseMutationContext | undefined);
    };
  }

  if (onSettled) {
    options.onSettled = onSettled;
  }

  return options;
}

/**
 * Mutation hook with optimistic update support per §5.6.5.
 *
 * @param options - mutation configuration including REST client, method, path, and callbacks
 * @returns TanStack Query mutation result (mutate, status, etc.)
 */
export function useMutation<TData = unknown, TError = unknown, TVariables = unknown>(
  options: UseMutationProps<TData, TError, TVariables>,
): UseMutationResult<TData, TError, TVariables, UseMutationContext> {
  const queryClient = useQueryClient();
  const mutationOptions = buildMutationOptions(options, queryClient);
  return useTanStackMutation<TData, TError, TVariables, UseMutationContext>(mutationOptions);
}

export { snapshotCache, rollbackCache, patchCache };
export type { SnapshotResult } from "./optimistic-update";

function normalizeSnapshots(value: SnapshotResult[] | SnapshotResult | undefined): SnapshotResult[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function resolveMutationBody<TVariables>(
  variables: TVariables,
  resolvedPath: string,
  body: unknown | ((variables: TVariables) => unknown) | undefined,
): unknown {
  if (body !== undefined) {
    return typeof body === "function" ? (body as (value: TVariables) => unknown)(variables) : body;
  }
  if (variables == null || typeof variables !== "object" || Array.isArray(variables)) {
    return variables;
  }
  const filteredEntries = Object.entries(variables as Record<string, unknown>).filter(([key, value]) => {
    if (typeof value !== "string" && typeof value !== "number") {
      return true;
    }
    return !(key === "id" || key.endsWith("Id")) || !resolvedPath.includes(`/${String(value)}`);
  });
  return filteredEntries.length === 0 ? undefined : Object.fromEntries(filteredEntries);
}
