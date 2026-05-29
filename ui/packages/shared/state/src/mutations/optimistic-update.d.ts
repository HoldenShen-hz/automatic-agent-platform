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
    readonly body?: unknown | ((variables: TVariables) => unknown);
    readonly onMutate?: (variables: TVariables) => Promise<SnapshotResult[] | SnapshotResult | undefined> | void;
    readonly onError?: (error: TError, variables: TVariables, context?: {
        previousData: SnapshotResult[];
    }) => void | Promise<void>;
    readonly onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables) => void | Promise<void>;
}
/**
 * Captures current cache state for one or more query keys.
 */
export declare function snapshotCache(queryClient: QueryClient, queryKeys: readonly unknown[][]): SnapshotResult[];
/**
 * Rolls back cache to previously snapshotted state.
 */
export declare function rollbackCache(queryClient: QueryClient, snapshots: SnapshotResult[]): void;
/**
 * Applies an optimistic patch to a single query key.
 * The updater function receives the current data and returns the patched data.
 */
export declare function patchCache<T>(queryClient: QueryClient, queryKey: readonly unknown[], updater: (current: T | undefined) => T): Promise<SnapshotResult>;
/**
 * Creates mutation options that implement the optimistic update pattern.
 *
 * The caller provides onMutate (which does snapshot + patch),
 * onError (which does rollback), and onSettled (which invalidates).
 * This function wires up the REST call and context passing.
 */
export declare function createOptimisticMutationOptions<TData, TError, TVariables>({ method, path, client, body, onMutate, onError, onSettled, }: MutationOptions<TData, TError, TVariables>): {
    mutationFn: (variables: TVariables) => Promise<TData>;
    onMutate: (variables: TVariables) => Promise<{
        previousData: void | SnapshotResult | SnapshotResult[] | undefined;
    } | undefined>;
    onError: (error: TError, variables: TVariables, context: {
        previousData: SnapshotResult[];
    } | undefined) => void;
    onSettled: (data: TData | undefined, error: TError | null, variables: TVariables) => Promise<void>;
};
