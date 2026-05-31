import { useQueuesQuery } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
import type { QueueDTO } from "@aa/shared-types";

export interface QueuesVm {
  readonly metrics: readonly { label: string; value: string | number }[];
}

export function mapQueuesToVm(queues: readonly QueueDTO[]): QueuesVm {
  return {
    metrics: [
      { label: translateMessage("ui.queues.metric.ready"), value: queues.reduce((total, queue) => total + queue.ready, 0) },
      { label: translateMessage("ui.queues.metric.inFlight"), value: queues.reduce((total, queue) => total + queue.inFlight, 0) },
      { label: translateMessage("ui.queues.metric.retries"), value: queues.reduce((total, queue) => total + queue.retries, 0) },
      { label: translateMessage("ui.queues.metric.dlq"), value: queues.reduce((total, queue) => total + queue.dlq, 0) },
    ],
  };
}

export function useQueuesVm(): QueuesVm {
  return mapQueuesToVm(useQueuesQuery().data ?? []);
}
