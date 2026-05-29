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
import { useMutation as useTanStackMutation, useQueryClient } from "@tanstack/react-query";
import { snapshotCache, rollbackCache, patchCache } from "./optimistic-update";
function buildMutationOptions(props, queryClient) {
    const { client, method, path, body, onMutate, onError, onSettled } = props;
    const baseMutationFn = async (variables) => {
        const resolvedPath = typeof path === "function" ? path(variables) : path;
        const resolvedBody = resolveMutationBody(variables, resolvedPath, body);
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
    };
    // Use type assertion to handle exactOptionalPropertyTypes correctly
    // The key insight: with exactOptionalPropertyTypes, optional properties must be
    // omitted (not set to undefined) when they are not provided
    const options = {
        mutationFn: baseMutationFn,
    };
    if (onMutate) {
        options.onMutate = async (variables) => {
            const previousData = await onMutate(variables, queryClient);
            return { previousData: normalizeSnapshots(previousData) };
        };
    }
    if (onError) {
        options.onError = (error, variables, context) => {
            onError(error, variables, context);
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
export function useMutation(options) {
    const queryClient = useQueryClient();
    const mutationOptions = buildMutationOptions(options, queryClient);
    return useTanStackMutation(mutationOptions);
}
export { snapshotCache, rollbackCache, patchCache };
function normalizeSnapshots(value) {
    if (value == null) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}
function resolveMutationBody(variables, resolvedPath, body) {
    if (body !== undefined) {
        return typeof body === "function" ? body(variables) : body;
    }
    if (variables == null || typeof variables !== "object" || Array.isArray(variables)) {
        return variables;
    }
    const filteredEntries = Object.entries(variables).filter(([key, value]) => {
        if (typeof value !== "string" && typeof value !== "number") {
            return true;
        }
        return !(key === "id" || key.endsWith("Id")) || !resolvedPath.includes(`/${String(value)}`);
    });
    return filteredEntries.length === 0 ? undefined : Object.fromEntries(filteredEntries);
}
