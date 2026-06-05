import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  cancelWorkflow,
  createTask,
  fetchTasks,
  pauseWorkflow as pauseWorkflowApi,
  recoverWorkflow as recoverWorkflowApi,
  resumeWorkflow as resumeWorkflowApi,
  updateTask,
  type CreateTaskResponse,
} from "@aa/shared-api-client";
import { taskQueryKeys, useRestClient, useTasksQuery } from "@aa/shared-state";
import type { TaskDTO, WorkflowRunStepDTO } from "@aa/shared-types";

type TimelineItem = { title: string; description: string };
type EvidenceItem = { id: string; type: string; description: string };
type TaskCockpitStepOutput = {
  readonly id: string;
  readonly nodeRunId?: string;
  readonly stepId?: string;
  readonly roleId?: string;
  readonly status?: "succeeded" | "failed" | "partial_success" | "skipped";
  readonly summary?: string | null;
  readonly producedAt?: string;
};
type TaskCockpitArtifact = {
  readonly artifactId: string;
  readonly kind?: string;
  readonly fileName?: string;
  readonly stepId?: string | null;
};
type TaskCockpitTimelineEntry = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly occurredAt: string;
};
type TaskCockpitResponse = {
  readonly snapshot?: {
    readonly workflow?: {
      readonly status?: string | null;
      readonly currentStepIndex?: number | null;
      readonly resumableFromStep?: string | null;
    } | null;
  };
  readonly inspect?: {
    readonly workflowState?: {
      readonly currentStepIndex?: number;
      readonly status?: string;
      readonly resumableFromStep?: string | null;
    } | null;
    readonly execution?: {
      readonly agentId?: string | null;
      readonly startedAt?: string;
      readonly finishedAt?: string | null;
    } | null;
    readonly stepOutputs?: readonly TaskCockpitStepOutput[];
    readonly artifacts?: readonly TaskCockpitArtifact[];
  };
  readonly timeline?: {
    readonly entries?: readonly TaskCockpitTimelineEntry[];
  };
};

export interface TaskCockpitVm {
  readonly tasks: readonly TaskDTO[];
  readonly listItems: readonly { id: string; title: string; subtitle: string }[];
  readonly loading: boolean;
  readonly loadError: string | null;
  readonly operationError: string | null;
  readonly selectedId: string | null;
  readonly selectedTask: (TaskDTO & { resourceUsage?: { cpuPercent?: number; memoryMb?: number; runtimeMinutes?: number } }) | null;
  readonly workflowControlsAvailable: boolean;
  readonly workflowControlReason: string | null;
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
  createTaskFromPrompt(input: { readonly title: string; readonly domainId?: string; readonly owner?: string }): Promise<void>;
  refreshTasks(): Promise<void>;
}

function sanitizeInput(value: string | undefined, fallback: string): string {
  const normalized = (value ?? fallback).replace(/[^a-z0-9-]/gi, "");
  return normalized.length > 0 ? normalized : fallback;
}

function sanitizeTaskTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

function mapTaskStatusToWorkflowStepStatus(status: TaskDTO["status"] | string | undefined): WorkflowRunStepDTO["status"] {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "queued":
      return "pending";
    default:
      return "running";
  }
}

function mapStepOutputStatus(status: TaskCockpitStepOutput["status"]): WorkflowRunStepDTO["status"] {
  switch (status) {
    case "failed":
      return "failed";
    case "succeeded":
    case "partial_success":
    case "skipped":
      return "completed";
    default:
      return "pending";
  }
}

function buildDrillDownSteps(
  task: TaskDTO | null,
  cockpit: TaskCockpitResponse,
): readonly WorkflowRunStepDTO[] {
  const execution = cockpit.inspect?.execution ?? null;
  const stepOutputs = cockpit.inspect?.stepOutputs ?? [];
  const completedSteps = stepOutputs.map((step, index) => ({
    id: step.nodeRunId ?? step.stepId ?? step.id,
    title: step.summary ?? step.stepId ?? `step-${index + 1}`,
    status: mapStepOutputStatus(step.status),
    executor: step.roleId ?? execution?.agentId ?? "unknown",
    ...(step.producedAt == null ? {} : { completedAt: step.producedAt }),
  }));

  if (task == null) {
    return completedSteps;
  }

  const currentStepId = task.currentStep;
  const alreadyTracked = completedSteps.some((step) => step.id === currentStepId || step.title === currentStepId);
  if (currentStepId.length === 0 || alreadyTracked) {
    return completedSteps;
  }

  const workflowState = cockpit.inspect?.workflowState ?? null;
  return [
    ...completedSteps,
    {
      id: currentStepId,
      title: workflowState?.resumableFromStep ?? currentStepId,
      status: mapTaskStatusToWorkflowStepStatus(task.status),
      executor: execution?.agentId ?? "unknown",
      ...(execution?.startedAt == null ? {} : { startedAt: execution.startedAt }),
      ...(execution?.finishedAt == null ? {} : { completedAt: execution.finishedAt }),
    },
  ];
}

function buildEvidenceItemsFromCockpit(
  taskId: string,
  cockpit: TaskCockpitResponse,
): readonly EvidenceItem[] {
  return (cockpit.inspect?.artifacts ?? []).map((artifact, index) => ({
    id: artifact.artifactId,
    type: artifact.kind ?? "artifact",
    description: artifact.fileName ?? artifact.stepId ?? `${taskId}-artifact-${index + 1}`,
  }));
}

function buildTimelineItemsFromCockpit(cockpit: TaskCockpitResponse): readonly TimelineItem[] {
  return (cockpit.timeline?.entries ?? []).map((entry) => ({
    title: entry.title,
    description: entry.summary,
  }));
}

function createLocalTaskId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `task-${slug.length > 0 ? slug : "new"}-${Date.now().toString(36)}`;
}

function readCreatedTaskId(response: CreateTaskResponse | null | undefined): string | null {
  const taskId = response?.snapshot?.task?.id;
  return typeof taskId === "string" && taskId.length > 0 ? taskId : null;
}

function describeOperationError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function areTasksEquivalent(left: readonly TaskDTO[], right: readonly TaskDTO[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightById = new Map(right.map((task) => [task.id, task]));
  return left.every((task) => {
    const candidate = rightById.get(task.id);
    return candidate != null
      && candidate.title === task.title
      && candidate.status === task.status
      && candidate.domainId === task.domainId
      && candidate.currentStep === task.currentStep
      && candidate.owner === task.owner
      && candidate.evidenceCount === task.evidenceCount
      && candidate.timelineDepth === task.timelineDepth
      && candidate.executionMode === task.executionMode
      && candidate.modelCallStatus === task.modelCallStatus
      && candidate.modelProvider === task.modelProvider
      && candidate.modelName === task.modelName
      && candidate.outputSummary === task.outputSummary
      && candidate.outputUri === task.outputUri;
  });
}

export function mapTasksToVm(tasks: readonly TaskDTO[]): readonly { id: string; title: string; subtitle: string }[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    subtitle: `${task.status} · ${task.domainId}`,
  }));
}

export function useTaskCockpitVm(): TaskCockpitVm {
  const client = useRestClient();
  const queryClient = useQueryClient();
  const taskQuery = useTasksQuery({ refetchInterval: 5000 });
  const tasks = taskQuery.data ?? [];
  const [loadedTasks, setLoadedTasks] = useState<readonly TaskDTO[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drillDownSteps, setDrillDownSteps] = useState<readonly WorkflowRunStepDTO[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [timelineItems, setTimelineItems] = useState<readonly TimelineItem[]>([]);
  const [serverTimelineItems, setServerTimelineItems] = useState<readonly TimelineItem[]>([]);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [loadingEvidence] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [serverEvidenceChain, setServerEvidenceChain] = useState<readonly EvidenceItem[]>([]);
  const [workflowControlsAvailable, setWorkflowControlsAvailable] = useState(true);
  const [workflowControlReason, setWorkflowControlReason] = useState<string | null>(null);

  const [optimisticTasks, setOptimisticTasks] = useState<readonly TaskDTO[] | null>(null);
  const refreshTasks = useCallback(async () => {
    const refreshedTasks = await fetchTasks(client);
    setLoadedTasks(refreshedTasks);
    setLoadError(null);
    queryClient.setQueryData<readonly TaskDTO[]>(taskQueryKeys.tasks, refreshedTasks);
    return refreshedTasks;
  }, [client, queryClient]);

  useEffect(() => {
    if (taskQuery.data == null) {
      return;
    }
    setLoadedTasks(taskQuery.data);
    setLoadError(null);
  }, [taskQuery.data]);

  useEffect(() => {
    if (taskQuery.data != null || taskQuery.isLoading) {
      return;
    }
    void refreshTasks().catch((error: unknown) => {
      setLoadError(error instanceof Error ? error.message : String(error));
    });
  }, [refreshTasks, taskQuery.data, taskQuery.isLoading]);

  useEffect(() => {
    if (optimisticTasks == null || taskQuery.data == null) {
      return;
    }
    if (areTasksEquivalent(optimisticTasks, taskQuery.data)) {
      setOptimisticTasks(null);
    }
  }, [optimisticTasks, taskQuery.data]);

  const visibleTasks = optimisticTasks ?? (tasks.length > 0 ? tasks : loadedTasks);
  const selectedTask = (visibleTasks.find((task) => task.id === selectedId) as TaskCockpitVm["selectedTask"] | undefined) ?? null;

  const evidenceChain = useMemo<readonly EvidenceItem[]>(() => {
    if (serverEvidenceChain.length > 0) {
      return serverEvidenceChain;
    }
    if (selectedTask == null) {
      return [];
    }
    const evidenceRefs = (selectedTask as TaskDTO & {
      readonly evidenceRefs?: ReadonlyArray<{
        readonly id?: string;
        readonly type?: string;
        readonly description?: string;
        readonly uri?: string;
      } | string>;
    }).evidenceRefs;
    if (evidenceRefs == null || evidenceRefs.length === 0) {
      return [];
    }
    return evidenceRefs.map((entry, index) => {
      if (typeof entry === "string") {
        return {
          id: `${selectedTask.id}-evidence-${index + 1}`,
          type: "reference",
          description: entry,
        };
      }
      return {
        id: entry.id ?? `${selectedTask.id}-evidence-${index + 1}`,
        type: entry.type ?? "reference",
        description: entry.description ?? entry.uri ?? `evidence:${index + 1}`,
      };
    });
  }, [selectedTask, serverEvidenceChain]);

  const timelineEvents = useMemo(
    () => [...timelineItems, ...serverTimelineItems].map((item, index) => ({ id: `timeline-${index + 1}`, title: item.title, description: item.description })),
    [serverTimelineItems, timelineItems],
  );

  const stepOutputs = useMemo(
    () => drillDownSteps
      .filter((step) => selectedStepId == null || step.id === selectedStepId)
      .map((step) => `${step.title} ${step.status} · ${step.executor ?? "unknown"}`),
    [drillDownSteps, selectedStepId],
  );

  const updateSelected = useCallback((body: Partial<TaskDTO>) => {
    if (selectedTask == null) {
      return null;
    }

    const previousTasks = visibleTasks;
    const nextTasks = visibleTasks.map((task) => task.id === selectedTask.id ? { ...task, ...body } : task);
    setOptimisticTasks(nextTasks);
    return () => {
      setOptimisticTasks(previousTasks);
    };
  }, [selectedTask, visibleTasks]);

  const runTaskMutation = useCallback(async (
    body: Partial<TaskDTO>,
    title: string,
    description: string,
  ) => {
    if (selectedTask == null) {
      return;
    }

    const rollback = updateSelected(body);
    if (rollback == null) {
      return;
    }
    setOperationError(null);
    setTimelineItems((current) => [{ title, description }, ...current]);
    setPendingOperations((current) => current + 1);

    try {
      await updateTask(client, selectedTask.id, body);
    } catch (error) {
      rollback?.();
      setOperationError(describeOperationError(error));
      setTimelineItems((current) => current.filter((item, index) => index !== 0));
      throw error;
    } finally {
      setPendingOperations((current) => Math.max(0, current - 1));
    }
  }, [client, selectedTask, updateSelected]);

  const fetchTaskDrillDown = useCallback(async (taskId: string) => {
    const cockpit = await client.get<TaskCockpitResponse>(`/v1/tasks/${encodeURIComponent(taskId)}`);
    const task = visibleTasks.find((candidate) => candidate.id === taskId) ?? null;
    const steps = buildDrillDownSteps(task, cockpit);
    const hasWorkflowControl = cockpit.inspect?.workflowState != null || cockpit.snapshot?.workflow != null;
    setServerEvidenceChain(buildEvidenceItemsFromCockpit(taskId, cockpit));
    setServerTimelineItems(buildTimelineItemsFromCockpit(cockpit));
    setDrillDownSteps(steps);
    setSelectedStepId(steps[0]?.id ?? null);
    setWorkflowControlsAvailable(hasWorkflowControl);
    setWorkflowControlReason(hasWorkflowControl ? null : "This task does not have a live workflow control record, so pause/retry/resume controls are unavailable.");
  }, [client, visibleTasks]);

  const selectTask = useCallback((id: string) => {
    setSelectedId(id);
    setOperationError(null);
    void fetchTaskDrillDown(id).catch(() => {
      setDrillDownSteps([]);
      setSelectedStepId(null);
      setServerEvidenceChain([]);
      setServerTimelineItems([]);
      setWorkflowControlsAvailable(false);
      setWorkflowControlReason("Task drill-down is unavailable.");
    });
  }, [fetchTaskDrillDown]);

  useEffect(() => {
    if (selectedId == null) {
      return;
    }
    void fetchTaskDrillDown(selectedId).catch(() => {
      setDrillDownSteps([]);
      setSelectedStepId(null);
      setServerEvidenceChain([]);
      setServerTimelineItems([]);
    });
  }, [
    fetchTaskDrillDown,
    selectedId,
    selectedTask?.currentStep,
    selectedTask?.evidenceCount,
    selectedTask?.outputSummary,
    selectedTask?.status,
  ]);

  const runWorkflowMutation = useCallback(async (
    action: () => Promise<unknown>,
    title: string,
    description: string,
  ) => {
    if (selectedTask == null) {
      return;
    }
    setOperationError(null);
    setTimelineItems((current) => [{ title, description }, ...current]);
    setPendingOperations((current) => current + 1);

    try {
      await action();
      await refreshTasks();
      await fetchTaskDrillDown(selectedTask.id);
    } catch (error) {
      setOperationError(describeOperationError(error));
      setTimelineItems((current) => current.filter((item, index) => index !== 0));
      throw error;
    } finally {
      setPendingOperations((current) => Math.max(0, current - 1));
    }
  }, [fetchTaskDrillDown, refreshTasks, selectedTask]);

  const createTaskFromPrompt = useCallback(async (
    input: { readonly title: string; readonly domainId?: string; readonly owner?: string },
  ) => {
    const title = sanitizeTaskTitle(input.title);
    if (title.length === 0) {
      throw new Error("task.title_required");
    }
    const domainId = sanitizeInput(input.domainId, "platform");
    const owner = input.owner == null || input.owner.trim().length === 0
      ? undefined
      : sanitizeInput(input.owner, "platform-sre");
    const nextTask: TaskDTO = {
      id: createLocalTaskId(title),
      title,
      status: "queued",
      domainId,
      currentStep: "intake",
      evidenceCount: 0,
      timelineDepth: 1,
      outputSummary: null,
      outputUri: null,
      ...(owner == null ? {} : { owner }),
    };
    const previousTasks = visibleTasks;
    const nextTasks = [nextTask, ...visibleTasks];
    setOptimisticTasks(nextTasks);
    queryClient.setQueryData<readonly TaskDTO[]>(taskQueryKeys.tasks, nextTasks);
    setSelectedId(nextTask.id);
    setDrillDownSteps([]);
    setSelectedStepId(null);
    setServerEvidenceChain([]);
    setServerTimelineItems([]);
    setTimelineItems((current) => [
      { title: `Created · ${title}`, description: `Queued in ${domainId} from operator input.` },
      ...current,
    ]);
    setPendingOperations((current) => current + 1);

    try {
      const created = await createTask(client, {
        title,
        divisionId: domainId,
        ...(owner == null ? {} : { owner }),
      });
      const createdTaskId = readCreatedTaskId(created);
      if (createdTaskId != null) {
        setOptimisticTasks((current) => current?.map((task) => (
          task.id === nextTask.id ? { ...task, id: createdTaskId } : task
        )) ?? current);
        setSelectedId(createdTaskId);
      }
      const refreshedTasks = await refreshTasks();
      setOptimisticTasks(null);
      const createdTask = (createdTaskId == null
        ? null
        : refreshedTasks.find((task) => task.id === createdTaskId) ?? null)
        ?? refreshedTasks.find((task) => task.title === title && task.domainId === domainId)
        ?? refreshedTasks[0]
        ?? null;
      setSelectedId(createdTask?.id ?? null);
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.tasks });
    } catch (error) {
      setOptimisticTasks(previousTasks);
      queryClient.setQueryData<readonly TaskDTO[]>(taskQueryKeys.tasks, previousTasks);
      setSelectedId(null);
      setTimelineItems((current) => current.slice(1));
      throw error;
    } finally {
      setPendingOperations((current) => Math.max(0, current - 1));
    }
  }, [client, queryClient, refreshTasks, visibleTasks]);

  return {
    tasks: visibleTasks,
    listItems: mapTasksToVm(visibleTasks),
    loading: taskQuery.isLoading && visibleTasks.length === 0,
    loadError: loadError ?? (taskQuery.error instanceof Error ? taskQuery.error.message : null),
    operationError,
    selectedId,
    selectedTask,
    workflowControlsAvailable,
    workflowControlReason,
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
      await runWorkflowMutation(
        () => pauseWorkflowApi(client, selectedTask.id),
        `Paused · ${selectedTask?.title ?? "task"}`,
        "Paused by operator.",
      );
    },
    async cancelTask() {
      await runWorkflowMutation(
        () => cancelWorkflow(client, selectedTask.id),
        `Cancelled · ${selectedTask?.title ?? "task"}`,
        "Cancelled by operator.",
      );
    },
    async retryTask() {
      await runWorkflowMutation(
        () => recoverWorkflowApi(client, selectedTask.id),
        `Retry · ${selectedTask?.title ?? "task"}`,
        "Retry requested.",
      );
    },
    async resumeTask(mode: "normal" | "supervised") {
      await runWorkflowMutation(
        () => resumeWorkflowApi(client, selectedTask.id, mode === "supervised" ? "supervised" : "normal"),
        `Resume · ${selectedTask?.title ?? "task"}`,
        `${mode} resume requested.`,
      );
    },
    async escalateTask(target = "domain-admin") {
      const sanitizedTarget = sanitizeInput(target, "domain-admin");
      await runTaskMutation(
        { status: "blocked" },
        `Escalated · ${selectedTask?.title ?? "task"}`,
        `Escalated to ${sanitizedTarget}.`,
      );
    },
    fetchTaskDrillDown,
    createTaskFromPrompt,
    async refreshTasks() {
      await refreshTasks();
    },
  };
}
