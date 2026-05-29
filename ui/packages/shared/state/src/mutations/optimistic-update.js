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
/**
 * Captures current cache state for one or more query keys.
 */
export function snapshotCache(queryClient, queryKeys) {
    return queryKeys.map((queryKey) => {
        const query = queryClient.getQueryData(queryKey);
        return { queryKey, data: query };
    });
}
/**
 * Rolls back cache to previously snapshotted state.
 */
export function rollbackCache(queryClient, snapshots) {
    for (const { queryKey, data } of snapshots) {
        if (data === undefined) {
            queryClient.removeQueries({ queryKey });
        }
        else {
            queryClient.setQueryData(queryKey, data);
        }
    }
}
/**
 * Applies an optimistic patch to a single query key.
 * The updater function receives the current data and returns the patched data.
 */
export async function patchCache(queryClient, queryKey, updater) {
    const snapshot = {
        queryKey,
        data: queryClient.getQueryData(queryKey),
    };
    await queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData(queryKey, updater(queryClient.getQueryData(queryKey)));
    return snapshot;
}
/**
 * Creates mutation options that implement the optimistic update pattern.
 *
 * The caller provides onMutate (which does snapshot + patch),
 * onError (which does rollback), and onSettled (which invalidates).
 * This function wires up the REST call and context passing.
 */
export function createOptimisticMutationOptions({ method, path, client, body, onMutate, onError, onSettled, }) {
    return {
        mutationFn: async (variables) => {
            const resolvedPath = typeof path === "function" ? path(variables) : path;
            const resolvedBody = body === undefined
                ? variables
                : typeof body === "function"
                    ? body(variables)
                    : body;
            switch (method) {
                case "POST":
                    return client.post(resolvedPath, resolvedBody);
                case "PUT":
                    return client.put(resolvedPath, resolvedBody);
                case "PATCH":
                    return client.patch(resolvedPath, resolvedBody);
                case "DELETE":
                    return client.delete(resolvedPath);
            }
        },
        onMutate: async (variables) => {
            if (onMutate) {
                return { previousData: await onMutate(variables) };
            }
            return undefined;
        },
        onError: (error, variables, context) => {
            if (onError) {
                onError(error, variables, context);
            }
        },
        onSettled: async (data, error, variables) => {
            if (onSettled) {
                await onSettled(data, error, variables);
            }
        },
    };
}
