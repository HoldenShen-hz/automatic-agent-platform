import { useEffect, useMemo, useState } from "react";
import { useTasksQuery } from "@aa/shared-state";
import type { TaskDTO } from "@aa/shared-types";

export interface TaskCockpitVm {
  readonly tasks: readonly TaskDTO[];
  readonly listItems: readonly { id: string; title: string; subtitle: string }[];
  readonly selectedId: string | null;
  readonly selectedTask: TaskDTO | null;
  readonly timelineItems: readonly { title: string; description: string }[];
  selectTask(id: string): void;
  claimTask(operator: string): void;
  resumeTask(mode: "normal" | "supervised"): void;
  escalateTask(target: string): void;
}

export function mapTasksToVm(tasks: readonly TaskDTO[]): Pick<TaskCockpitVm, "tasks" | "listItems"> {
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
  const queryTasks = useTasksQuery().data ?? [];
  const [tasks, setTasks] = useState<readonly TaskDTO[]>(queryTasks);
  const [selectedId, setSelectedId] = useState<string | null>(queryTasks[0]?.id ?? null);
  const [timelineItems, setTimelineItems] = useState<readonly { title: string; description: string }[]>([]);

  useEffect(() => {
    setTasks(queryTasks);
    setSelectedId((current) => current ?? queryTasks[0]?.id ?? null);
  }, [queryTasks]);

  const baseVm = useMemo(() => mapTasksToVm(tasks), [tasks]);
  const selectedTask = tasks.find((task) => task.id === selectedId) ?? tasks[0] ?? null;

  function updateSelected(transform: (task: TaskDTO) => TaskDTO, title: string, description: string): void {
    if (selectedTask == null) {
      return;
    }
    setTasks((current) => current.map((task) => task.id === selectedTask.id ? transform(task) : task));
    setTimelineItems((current) => [{ title, description }, ...current]);
  }

  return {
    ...baseVm,
    selectedId,
    selectedTask,
    timelineItems,
    selectTask(id: string) {
      setSelectedId(id);
    },
    claimTask(operator: string) {
      updateSelected(
        (task) => ({ ...task, owner: operator, status: "running" }),
        `Takeover · ${selectedTask?.title ?? "task"}`,
        `${operator} claimed the task and resumed ownership.`,
      );
    },
    resumeTask(mode: "normal" | "supervised") {
      updateSelected(
        (task) => ({ ...task, status: "running", currentStep: mode === "supervised" ? "supervised-resume" : "resume" }),
        `Resume · ${selectedTask?.title ?? "task"}`,
        `${mode} mode resume was requested through HITL.`,
      );
    },
    escalateTask(target: string) {
      updateSelected(
        (task) => ({ ...task, status: "blocked", currentStep: `escalated:${target}` }),
        `Escalated · ${selectedTask?.title ?? "task"}`,
        `Task was escalated to ${target} for review.`,
      );
    },
  };
}
