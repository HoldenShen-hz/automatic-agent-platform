import { useIncidentsQuery, useQueuesQuery, useWorkersQuery } from "@aa/shared-state";
import type { IncidentDTO, QueueDTO, WorkerDTO } from "@aa/shared-types";

export interface StabilityVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly items: readonly { title: string; description: string }[];
}

export function mapStabilityToVm(
  incidents: readonly IncidentDTO[],
  workers: readonly WorkerDTO[],
  queues: readonly QueueDTO[],
): StabilityVm {
  return {
    metrics: [
      { label: "Incidents", value: incidents.length },
      { label: "Workers", value: workers.length },
      { label: "Queues", value: queues.length },
      { label: "DLQ", value: queues.reduce((total, queue) => total + queue.dlq, 0) },
    ],
    items: incidents.map((incident) => ({
      title: `${incident.severity.toUpperCase()} · ${incident.title}`,
      description: incident.summary,
    })),
  };
}

export function useStabilityVm(): StabilityVm {
  return mapStabilityToVm(
    useIncidentsQuery().data ?? [],
    useWorkersQuery().data ?? [],
    useQueuesQuery().data ?? [],
  );
}
