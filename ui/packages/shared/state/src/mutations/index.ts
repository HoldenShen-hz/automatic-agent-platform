/**
 * Mutation hooks and optimistic update utilities per §5.6.5.
 *
 * Provides:
 * - useMutation hook with full optimistic update pattern support
 * - snapshotCache / rollbackCache / patchCache helpers
 * - createOptimisticMutationOptions factory for per-mutation configuration
 *
 * Usage with optimistic updates:
 * ```tsx
 * const queryClient = useQueryClient();
 * const { mutate, status } = useMutation({
 *   ...createOptimisticMutationOptions({
 *     client: restClient,
 *     method: "PATCH",
 *     path: (v) => `/tasks/${v.taskId}`,
 *     onMutate: async (variables) => {
 *       const previous = await snapshotCache(queryClient, [["tasks", variables.taskId]]);
 *       await patchCache(queryClient, ["tasks", variables.taskId], (old) => ({
 *         ...old!,
 *         status: variables.status,
 *       }));
 *       return { previousData: previous };
 *     },
 *     onError: (_err, _vars, context) => {
 *       if (context?.previousData) rollbackCache(queryClient, context.previousData);
 *     },
 *     onSettled: () => {
 *       queryClient.invalidateQueries({ queryKey: ["tasks"] });
 *     },
 *   }),
 * });
 * ```
 */

export * from "./use-mutation";
export * from "./optimistic-update";
