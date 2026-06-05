import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { drainWorkers } from "@aa/shared-api-client";
import { missionControlQueryKeys, useRestClient, useWorkersQuery } from "@aa/shared-state";
export function mapWorkersToVm(workers) {
    const busyWorkerCount = workers.filter((worker) => worker.status === "busy").length;
    return {
        metrics: [
            { label: "Active Workers", value: workers.length },
            { label: "Busy", value: busyWorkerCount },
            { label: "Draining", value: workers.filter((worker) => worker.status === "draining").length },
            { label: "Heartbeat Lag", value: workers.length === 0 ? "0ms" : `${Math.max(...workers.map((worker) => worker.heartbeatLagMs))}ms` },
        ],
        busyWorkerCount,
    };
}
export function useWorkersVm() {
    const client = useRestClient();
    const queryClient = useQueryClient();
    const workers = useWorkersQuery().data ?? [];
    const refresh = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: missionControlQueryKeys.workers });
        await queryClient.refetchQueries({ queryKey: missionControlQueryKeys.workers, type: "active" });
    }, [queryClient]);
    const drainBusyWorkers = useCallback(async () => {
        await drainWorkers(client);
        await refresh();
    }, [client, refresh]);
    return useMemo(() => ({
        ...mapWorkersToVm(workers),
        refresh,
        drainBusyWorkers,
    }), [drainBusyWorkers, refresh, workers]);
}
