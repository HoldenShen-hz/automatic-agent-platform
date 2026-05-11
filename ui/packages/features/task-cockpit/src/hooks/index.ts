import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useTasksQuery } from "@aa/shared-state";
import type { TaskDTO, WorkflowRunStepDTO } from "@aa/shared-types";
import { createRESTClient } from "@aa/shared-api-client";

const restClient = createRESTClient();

export interface TaskCockpitVm {
  readonly tasks: readonly TaskDTO[];
  readonly listItems: readonly { id: string; title: string; subtitle: string }[];
  readonly selectedId: string | null;
  readonly selectedTask: TaskDTO | null;
  readonly timelineItems: readonly { title: string; description: string }[];
  readonly drillDownSteps: readonly WorkflowRunStepDTO[];
  readonly pendingOperations: number;
  selectTask(id: string): void;
  claimTask(operator: string): Promise<void>;
  resumeTask(mode: "normal" | "supervised"): Promise<void>;
  escalateTask(target: string): Promise<void>;
  fetchTaskDrillDown(taskId: string): Promise<void>;
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
  const [drillDownSteps, setDrillDownSteps] = useState<readonly WorkflowRunStepDTO[]>([]);
  const [pendingOperations, setPendingOperations] = useState(0);

  const { mutate: updateTaskMutate, status: updateStatus } = useMutation({
    client: restClient,
    method: "PUT",
    path: (variables: { taskId: string; body: Partial<TaskDTO> }) => `/tasks/${variables.taskId}`,
  });

  useEffect(() => {
    setTasks(queryTasks);
    setSelectedId((current) => current ?? queryTasks[0]?.id ?? null);
  }, [queryTasks]);

  useEffect(() => {
    setPendingOperations(updateStatus === "pending" ? 1 : 0);
  }, [updateStatus]);

  const baseVm = useMemo(() => mapTasksToVm(tasks), [tasks]);
  const selectedTask = tasks.find((task) => task.id === selectedId) ?? tasks[0] ?? null;

  function updateSelected(transform: (task: TaskDTO) => TaskDTO, title: string, description: string): (() => void) | undefined {
    if (selectedTask == null) {
      return undefined;
    }
    const previousTasks = tasks;
    const previousTimelineItems = timelineItems;
    setTasks((current) => current.map((task) => task.id === selectedTask.id ? transform(task) : task));
    setTimelineItems((current) => [{ title, description }, ...current]);
    return () => {
      setTasks(previousTasks);
      setTimelineItems(previousTimelineItems);
    };
  }

  const claimTask = useCallback(async (operator: string) => {
    if (selectedTask == null) return;
    const rollback = updateSelected(
      (task) => ({ ...task, owner: operator, status: "running" }),
      `Takeover · ${selectedTask.title}`,
      `${operator} claimed the task and resumed ownership.`,
    );
    return new Promise<void>((resolve, reject) => {
      updateTaskMutate(
        { taskId: selectedTask.id, body: { owner: operator, status: "running" } },
        {
          onSuccess: () => resolve(),
          onError: (err) => {
            rollback?.();
            reject(err);
          },
        },
      );
    });
  }, [selectedTask, tasks, timelineItems, updateTaskMutate]);

  const resumeTask = useCallback(async (mode: "normal" | "supervised") => {
    if (selectedTask == null) return;
    const step = mode === "supervised" ? "supervised-resume" : "resume";
    const rollback = updateSelected(
      (task) => ({ ...task, status: "running", currentStep: step }),
      `Resume · ${selectedTask.title}`,
      `${mode} mode resume was requested through HITL.`,
    );
    return new Promise<void>((resolve, reject) => {
      updateTaskMutate(
        { taskId: selectedTask.id, body: { status: "running", currentStep: step } },
        {
          onSuccess: () => resolve(),
          onError: (err) => {
            rollback?.();
            reject(err);
          },
        },
      );
    });
  }, [selectedTask, tasks, timelineItems, updateTaskMutate]);

  const escalateTask = useCallback(async (target: string) => {
    if (selectedTask == null) return;
    const step = `escalated:${target}`;
    const rollback = updateSelected(
      (task) => ({ ...task, status: "blocked", currentStep: step }),
      `Escalated · ${selectedTask.title}`,
      `Task was escalated to ${target} for review.`,
    );
    return new Promise<void>((resolve, reject) => {
      updateTaskMutate(
        { taskId: selectedTask.id, body: { status: "blocked", currentStep: step } },
        {
          onSuccess: () => resolve(),
          onError: (err) => {
            rollback?.();
            reject(err);
          },
        },
      );
    });
  }, [selectedTask, tasks, timelineItems, updateTaskMutate]);

  const fetchTaskDrillDown = useCallback(async (taskId: string) => {
    try {
      const steps = await restClient.get<readonly WorkflowRunStepDTO[]>(`/workflow-runs/${taskId}/steps`);
      setDrillDownSteps(steps);
    } catch {
      setDrillDownSteps([]);
    }
  }, []);

  return {
    ...baseVm,
    selectedId,
    selectedTask,
    timelineItems,
    drillDownSteps,
    pendingOperations,
    selectTask(id: string) {
      setSelectedId(id);
    },
    claimTask,
    resumeTask,
    escalateTask,
    fetchTaskDrillDown,
  };
}
