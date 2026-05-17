import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWorkflowRunSteps, updateTask } from "@aa/shared-api-client";
import { useRestClient, useTasksQuery } from "@aa/shared-state";
import type { TaskDTO, WorkflowRunStepDTO } from "@aa/shared-types";

type TimelineItem = { title: string; description: string };
type EvidenceItem = { id: string; type: string; description: string };

export interface TaskCockpitVm {
  readonly tasks: readonly TaskDTO[];
  readonly listItems: readonly { id: string; title: string; subtitle: string }[];
  readonly selectedId: string | null;
  readonly selectedTask: (TaskDTO & { resourceUsage?: { cpuPercent?: number; memoryMb?: number; runtimeMinutes?: number } }) | null;
  readonly timelineItems: readonly TimelineItem[];
  readonly drillDownSteps: readonly WorkflowRunStepDTO[];
  readonly pendingOperations: number;
  readonly stepViewer: {
    readonly steps: readonly WorkflowRunStepDTO[];
    readonly selectedStep: WorkflowRunStepDTO | null;
    readonly stepOutputs: readonly string[];
    selectStep(stepId: string): void;
  };
  readonly evidenceViewer: {
    readonly evidenceChain: readonly EvidenceItem[];
    readonly loading: boolean;
  };
  readonly timelineViewer: {
    readonly timelineEvents: readonly { id: string; title: string; description: string }[];
    readonly expandedEventId: string | null;
    expandEvent(eventId: string): void;
  };
  selectTask(id: string): void;
  claimTask(operator?: string): Promise<void>;
  pauseTask(): Promise<void>;
  cancelTask(): Promise<void>;
  retryTask(): Promise<void>;
  resumeTask(mode: "normal" | "supervised"): Promise<void>;
  escalateTask(target?: string): Promise<void>;
  fetchTaskDrillDown(taskId: string): Promise<void>;
}

function sanitizeInput(value: string | undefined, fallback: string): string {
  const normalized = (value ?? fallback).replace(/[^a-z0-9-]/gi, "");
  return normalized.length > 0 ? normalized : fallback;
}

function mapTasksToVm(tasks: readonly TaskDTO[]): readonly { id: string; title: string; subtitle: string }[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    subtitle: `${task.status} · ${task.domainId}`,
  }));
}

export function useTaskCockpitVm(): TaskCockpitVm {
  const client = useRestClient();
  const taskQuery = (useTasksQuery as unknown as (
    query?: unknown,
    options?: { refetchInterval?: number },
  ) => ReturnType<typeof useTasksQuery>)(undefined, { refetchInterval: 5000 });
  const tasks = taskQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drillDownSteps, setDrillDownSteps] = useState<readonly WorkflowRunStepDTO[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [timelineItems, setTimelineItems] = useState<readonly TimelineItem[]>([]);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [loadingEvidence] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const [optimisticTasks, setOptimisticTasks] = useState<readonly TaskDTO[] | null>(null);
  useEffect(() => {
    setOptimisticTasks(null);
  }, [taskQuery.data]);

  const visibleTasks = optimisticTasks ?? tasks;
  const selectedTask = (visibleTasks.find((task) => task.id === selectedId) as TaskCockpitVm["selectedTask"] | undefined) ?? null;

  const evidenceChain = useMemo<readonly EvidenceItem[]>(() => {
    if (selectedTask == null) {
      return [];
    }
    return Array.from({ length: Math.max(1, selectedTask.evidenceCount ?? 0) }, (_value, index) => ({
      id: `evidence-${selectedTask.id}-${index + 1}`,
      type: "artifact",
      description: index === 0 ? "Approval packet" : `Evidence item ${index + 1}`,
    }));
  }, [selectedTask]);

  const timelineEvents = useMemo(
    () => timelineItems.map((item, index) => ({ id: `timeline-${index + 1}`, title: item.title, description: item.description })),
    [timelineItems],
  );

  const stepOutputs = useMemo(
    () => drillDownSteps
      .filter((step) => selectedStepId == null || step.id === selectedStepId)
      .map((step) => `${step.title} ${step.status} · ${step.executor ?? "unknown"}`),
    [drillDownSteps, selectedStepId],
  );

  const runTaskMutation = useCallback(async (
    body: Partial<TaskDTO>,
    title: string,
    description: string,
  ) => {
    if (selectedTask == null) {
      return;
    }

    const previousTasks = visibleTasks;
    const nextTasks = visibleTasks.map((task) => task.id === selectedTask.id ? { ...task, ...body } : task);
    setOptimisticTasks(nextTasks);
    setTimelineItems((current) => [{ title, description }, ...current]);
    setPendingOperations((current) => current + 1);

    try {
      await updateTask(client, selectedTask.id, body);
    } catch (error) {
      setOptimisticTasks(previousTasks);
      setTimelineItems((current) => current.filter((item, index) => index !== 0));
      throw error;
    } finally {
      setPendingOperations((current) => Math.max(0, current - 1));
    }
  }, [client, selectedTask, visibleTasks]);

  const fetchTaskDrillDown = useCallback(async (taskId: string) => {
    const steps = await fetchWorkflowRunSteps(client, taskId);
    setDrillDownSteps(steps);
    setSelectedStepId(steps[0]?.id ?? null);
  }, [client]);

  const selectTask = useCallback((id: string) => {
    setSelectedId(id);
    void fetchTaskDrillDown(id).catch(() => {
      setDrillDownSteps([]);
      setSelectedStepId(null);
    });
  }, [fetchTaskDrillDown]);

  return {
    tasks: visibleTasks,
    listItems: mapTasksToVm(visibleTasks),
    selectedId,
    selectedTask,
    timelineItems,
    drillDownSteps,
    pendingOperations,
    stepViewer: {
      steps: drillDownSteps,
      selectedStep: drillDownSteps.find((step) => step.id === selectedStepId) ?? null,
      stepOutputs,
      selectStep(stepId) {
        setSelectedStepId(stepId);
      },
    },
    evidenceViewer: {
      evidenceChain,
      loading: loadingEvidence,
    },
    timelineViewer: {
      timelineEvents,
      expandedEventId,
      expandEvent(eventId) {
        setExpandedEventId(eventId);
      },
    },
    selectTask,
    async claimTask(operator = "platform-sre") {
      const sanitizedOperator = sanitizeInput(operator, "platform-sre");
      await runTaskMutation(
        { owner: sanitizedOperator, status: "running" },
        `Take Over · ${selectedTask?.title ?? "task"}`,
        `${sanitizedOperator} claimed the task and resumed ownership.`,
      );
    },
    async pauseTask() {
      await runTaskMutation(
        { status: "paused" as TaskDTO["status"], currentStep: "paused_by_operator" },
        `Paused · ${selectedTask?.title ?? "task"}`,
        "Paused by operator.",
      );
    },
    async cancelTask() {
      await runTaskMutation(
        { status: "cancelled" as TaskDTO["status"], currentStep: "cancelled_by_operator" },
        `Cancelled · ${selectedTask?.title ?? "task"}`,
        "Cancelled by operator.",
      );
    },
    async retryTask() {
      await runTaskMutation(
        { status: "queued", currentStep: "retry_requested" },
        `Retry · ${selectedTask?.title ?? "task"}`,
        "Retry requested.",
      );
    },
    async resumeTask(mode: "normal" | "supervised") {
      const currentStep = mode === "supervised" ? "supervised-resume" : "resume";
      await runTaskMutation(
        { status: "running", currentStep },
        `Resume · ${selectedTask?.title ?? "task"}`,
        `${mode} resume requested.`,
      );
    },
    async escalateTask(target = "domain-admin") {
      const sanitizedTarget = sanitizeInput(target, "domain-admin");
      await runTaskMutation(
        { status: "blocked", currentStep: `escalated:${sanitizedTarget}` },
        `Escalated · ${selectedTask?.title ?? "task"}`,
        `Escalated to ${sanitizedTarget}.`,
      );
    },
    fetchTaskDrillDown,
  };
}
