import { useWorkersQuery } from "@aa/shared-state";
import type { WorkerDTO } from "@aa/shared-types";

export interface WorkersVm {
  readonly metrics: readonly { label: string; value: string | number }[];
}

export function mapWorkersToVm(workers: readonly WorkerDTO[]): WorkersVm {
  return {
    metrics: [
      { label: "Active Workers", value: workers.length },
      { label: "Busy", value: workers.filter((worker) => worker.status === "busy").length },
      { label: "Draining", value: workers.filter((worker) => worker.status === "draining").length },
      { label: "Heartbeat Lag", value: workers.length === 0 ? "0ms" : `${Math.max(...workers.map((worker) => worker.heartbeatLagMs))}ms` },
    ],
  };
}

export function useWorkersVm(): WorkersVm {
  return mapWorkersToVm(useWorkersQuery().data ?? []);
}
