import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { drainWorkers } from "@aa/shared-api-client";
import { missionControlQueryKeys, useRestClient, useWorkersQuery } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
import type { WorkerDTO } from "@aa/shared-types";

export interface WorkersVm {
  readonly loading: boolean;
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly busyWorkerCount: number;
  refresh(): Promise<void>;
  drainBusyWorkers(): Promise<void>;
}

export function mapWorkersToVm(workers: readonly WorkerDTO[]): Pick<WorkersVm, "metrics" | "busyWorkerCount"> {
  const liveWorkers = workers.filter((worker) => worker.status !== "offline");
  const busyWorkerCount = workers.filter((worker) => worker.status === "busy").length;
  return {
    metrics: [
      { label: translateMessage("ui.workers.metric.active"), value: liveWorkers.length },
      { label: translateMessage("ui.workers.metric.busy"), value: busyWorkerCount },
      { label: translateMessage("ui.workers.metric.draining"), value: workers.filter((worker) => worker.status === "draining").length },
      { label: translateMessage("ui.workers.metric.offline"), value: workers.filter((worker) => worker.status === "offline").length },
      {
        label: translateMessage("ui.workers.metric.heartbeatLag"),
        value: liveWorkers.length === 0 ? "n/a" : `${Math.max(...liveWorkers.map((worker) => worker.heartbeatLagMs))}ms`,
      },
    ],
    busyWorkerCount,
  };
}

export function useWorkersVm(): WorkersVm {
  const client = useRestClient();
  const queryClient = useQueryClient();
  const workersQuery = useWorkersQuery();
  const workers = workersQuery.data ?? [];
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
    loading: workersQuery.isLoading,
    refresh,
    drainBusyWorkers,
  }), [drainBusyWorkers, refresh, workers, workersQuery.isLoading]);
}
