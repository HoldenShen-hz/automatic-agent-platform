import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { drainWorkers } from "@aa/shared-api-client";
import { missionControlQueryKeys, useRestClient, useWorkersQuery } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
import type { WorkerDTO } from "@aa/shared-types";

export interface WorkersVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly busyWorkerCount: number;
  refresh(): Promise<void>;
  drainBusyWorkers(): Promise<void>;
}

export function mapWorkersToVm(workers: readonly WorkerDTO[]): Pick<WorkersVm, "metrics" | "busyWorkerCount"> {
  const busyWorkerCount = workers.filter((worker) => worker.status === "busy").length;
  return {
    metrics: [
      { label: translateMessage("ui.workers.metric.active"), value: workers.length },
      { label: translateMessage("ui.workers.metric.busy"), value: busyWorkerCount },
      { label: translateMessage("ui.workers.metric.draining"), value: workers.filter((worker) => worker.status === "draining").length },
      {
        label: translateMessage("ui.workers.metric.heartbeatLag"),
        value: workers.length === 0 ? "0ms" : `${Math.max(...workers.map((worker) => worker.heartbeatLagMs))}ms`,
      },
    ],
    busyWorkerCount,
  };
}

export function useWorkersVm(): WorkersVm {
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
