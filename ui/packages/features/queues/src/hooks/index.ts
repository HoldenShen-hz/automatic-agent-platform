import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cleanupRetryQueue } from "@aa/shared-api-client";
import { missionControlQueryKeys, useQueuesQuery, useRestClient } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
import type { QueueDTO } from "@aa/shared-types";

export interface QueuesVm {
  readonly loading: boolean;
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly retryQueueDepth: number;
  refresh(): Promise<void>;
  cleanupRetryQueue(): Promise<void>;
}

export function mapQueuesToVm(queues: readonly QueueDTO[]): Pick<QueuesVm, "metrics" | "retryQueueDepth"> {
  const retryQueueDepth = queues.reduce((total, queue) => total + queue.retries, 0);
  return {
    metrics: [
      { label: translateMessage("ui.queues.metric.ready"), value: queues.reduce((total, queue) => total + queue.ready, 0) },
      { label: translateMessage("ui.queues.metric.inFlight"), value: queues.reduce((total, queue) => total + queue.inFlight, 0) },
      { label: translateMessage("ui.queues.metric.retries"), value: retryQueueDepth },
      { label: translateMessage("ui.queues.metric.dlq"), value: queues.reduce((total, queue) => total + queue.dlq, 0) },
    ],
    retryQueueDepth,
  };
}

export function useQueuesVm(): QueuesVm {
  const client = useRestClient();
  const queryClient = useQueryClient();
  const queuesQuery = useQueuesQuery();
  const queues = queuesQuery.data ?? [];
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
    loading: queuesQuery.isLoading,
    refresh,
    cleanupRetryQueue: cleanupRetryQueueAction,
  }), [cleanupRetryQueueAction, queues, queuesQuery.isLoading, refresh]);
}
