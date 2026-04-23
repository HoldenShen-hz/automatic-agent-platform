import { useTasksQuery } from "@aa/shared-state";
import type { TaskDTO } from "@aa/shared-types";

export interface TaskCockpitVm {
  readonly tasks: readonly TaskDTO[];
  readonly listItems: readonly { id: string; title: string; subtitle: string }[];
}

export function mapTasksToVm(tasks: readonly TaskDTO[]): TaskCockpitVm {
  return {
    tasks,
    listItems: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      subtitle: `${task.status} · ${task.domainId}`,
    })),
  };
}

export function useTaskCockpitVm(): TaskCockpitVm {
  return mapTasksToVm(useTasksQuery().data ?? []);
}
