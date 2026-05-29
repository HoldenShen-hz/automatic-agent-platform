import { useWorkersQuery } from "@aa/shared-state";
export function mapWorkersToVm(workers) {
    return {
        metrics: [
            { label: "Active Workers", value: workers.length },
            { label: "Busy", value: workers.filter((worker) => worker.status === "busy").length },
            { label: "Draining", value: workers.filter((worker) => worker.status === "draining").length },
            { label: "Heartbeat Lag", value: workers.length === 0 ? "0ms" : `${Math.max(...workers.map((worker) => worker.heartbeatLagMs))}ms` },
        ],
    };
}
export function useWorkersVm() {
    return mapWorkersToVm(useWorkersQuery().data ?? []);
}
