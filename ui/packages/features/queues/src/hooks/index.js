import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cleanupRetryQueue } from "@aa/shared-api-client";
import { missionControlQueryKeys, useQueuesQuery, useRestClient } from "@aa/shared-state";
export function mapQueuesToVm(queues) {
    const retryQueueDepth = queues.reduce((total, queue) => total + queue.retries, 0);
    return {
        metrics: [
            { label: "Ready", value: queues.reduce((total, queue) => total + queue.ready, 0) },
            { label: "In Flight", value: queues.reduce((total, queue) => total + queue.inFlight, 0) },
            { label: "Retries", value: retryQueueDepth },
            { label: "DLQ", value: queues.reduce((total, queue) => total + queue.dlq, 0) },
        ],
        retryQueueDepth,
    };
}
export function useQueuesVm() {
    const client = useRestClient();
    const queryClient = useQueryClient();
    const queues = useQueuesQuery().data ?? [];
    const refresh = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: missionControlQueryKeys.queues });
        await queryClient.refetchQueries({ queryKey: missionControlQueryKeys.queues, type: "active" });
    }, [queryClient]);
    const cleanupRetryQueueAction = useCallback(async () => {
        await cleanupRetryQueue(client);
        await refresh();
    }, [client, refresh]);
    return useMemo(() => ({
        ...mapQueuesToVm(queues),
        refresh,
        cleanupRetryQueue: cleanupRetryQueueAction,
    }), [cleanupRetryQueueAction, queues, refresh]);
}
