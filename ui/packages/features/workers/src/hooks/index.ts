import { useWorkersQuery } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
import type { WorkerDTO } from "@aa/shared-types";

export interface WorkersVm {
  readonly metrics: readonly { label: string; value: string | number }[];
}

export function mapWorkersToVm(workers: readonly WorkerDTO[]): WorkersVm {
  return {
    metrics: [
      { label: translateMessage("ui.workers.metric.active"), value: workers.length },
      { label: translateMessage("ui.workers.metric.busy"), value: workers.filter((worker) => worker.status === "busy").length },
      { label: translateMessage("ui.workers.metric.draining"), value: workers.filter((worker) => worker.status === "draining").length },
      {
        label: translateMessage("ui.workers.metric.heartbeatLag"),
        value: workers.length === 0 ? "0ms" : `${Math.max(...workers.map((worker) => worker.heartbeatLagMs))}ms`,
      },
    ],
  };
}

export function useWorkersVm(): WorkersVm {
  return mapWorkersToVm(useWorkersQuery().data ?? []);
}
