import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  cancelWorkflow,
  createTask,
  fetchTasks,
  pauseWorkflow as pauseWorkflowApi,
  recoverWorkflow as recoverWorkflowApi,
  resumeWorkflow as resumeWorkflowApi,
  updateTask
} from "@aa/shared-api-client";
import { taskQueryKeys, useRestClient, useTasksQuery } from "@aa/shared-state";
function sanitizeInput(value, fallback) {
  const normalized = (value ?? fallback).replace(/[^a-z0-9-]/gi, "");
  return normalized.length > 0 ? normalized : fallback;
}
function sanitizeTaskTitle(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}
function mapTaskStatusToWorkflowStepStatus(status) {
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
function mapStepOutputStatus(status) {
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
function buildDrillDownSteps(task, cockpit) {
  const execution = cockpit.inspect?.execution ?? null;
  const stepOutputs = cockpit.inspect?.stepOutputs ?? [];
  const completedSteps = stepOutputs.map((step, index) => ({
    id: step.nodeRunId ?? step.stepId ?? step.id,
    title: step.summary ?? step.stepId ?? `step-${index + 1}`,
    status: mapStepOutputStatus(step.status),
    executor: step.roleId ?? execution?.agentId ?? "unknown",
    ...step.producedAt == null ? {} : { completedAt: step.producedAt }
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
      ...execution?.startedAt == null ? {} : { startedAt: execution.startedAt },
      ...execution?.finishedAt == null ? {} : { completedAt: execution.finishedAt }
    }
  ];
}
function buildEvidenceItemsFromCockpit(taskId, cockpit) {
  return (cockpit.inspect?.artifacts ?? []).map((artifact, index) => ({
    id: artifact.artifactId,
    type: artifact.kind ?? "artifact",
    description: artifact.fileName ?? artifact.stepId ?? `${taskId}-artifact-${index + 1}`
  }));
}
function buildTimelineItemsFromCockpit(cockpit) {
  return (cockpit.timeline?.entries ?? []).map((entry) => ({
    title: entry.title,
    description: entry.summary
  }));
}
function createLocalTaskId(title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/giu, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return `task-${slug.length > 0 ? slug : "new"}-${Date.now().toString(36)}`;
}
function readCreatedTaskId(response) {
  const taskId = response?.snapshot?.task?.id;
  return typeof taskId === "string" && taskId.length > 0 ? taskId : null;
}
function describeOperationError(error) {
  return error instanceof Error ? error.message : String(error);
}
function areTasksEquivalent(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  const rightById = new Map(right.map((task) => [task.id, task]));
  return left.every((task) => {
    const candidate = rightById.get(task.id);
    return candidate != null && candidate.title === task.title && candidate.status === task.status && candidate.domainId === task.domainId && candidate.currentStep === task.currentStep && candidate.owner === task.owner && candidate.evidenceCount === task.evidenceCount && candidate.timelineDepth === task.timelineDepth && candidate.executionMode === task.executionMode && candidate.modelCallStatus === task.modelCallStatus && candidate.modelProvider === task.modelProvider && candidate.modelName === task.modelName && candidate.outputSummary === task.outputSummary && candidate.outputUri === task.outputUri;
  });
}
function mapTasksToVm(tasks) {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    subtitle: `${task.status} \xB7 ${task.domainId}`
  }));
}
function useTaskCockpitVm() {
  const client = useRestClient();
  const queryClient = useQueryClient();
  const taskQuery = useTasksQuery({ refetchInterval: 5e3 });
  const tasks = taskQuery.data ?? [];
  const [loadedTasks, setLoadedTasks] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [operationError, setOperationError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [drillDownSteps, setDrillDownSteps] = useState([]);
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [timelineItems, setTimelineItems] = useState([]);
  const [serverTimelineItems, setServerTimelineItems] = useState([]);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [loadingEvidence] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState(null);
  const [serverEvidenceChain, setServerEvidenceChain] = useState([]);
  const [workflowControlsAvailable, setWorkflowControlsAvailable] = useState(true);
  const [workflowControlReason, setWorkflowControlReason] = useState(null);
  const [optimisticTasks, setOptimisticTasks] = useState(null);
  const refreshTasks = useCallback(async () => {
    const refreshedTasks = await fetchTasks(client);
    setLoadedTasks(refreshedTasks);
    setLoadError(null);
    queryClient.setQueryData(taskQueryKeys.tasks, refreshedTasks);
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
    void refreshTasks().catch((error) => {
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
  const selectedTask = visibleTasks.find((task) => task.id === selectedId) ?? null;
  const evidenceChain = useMemo(() => {
    if (serverEvidenceChain.length > 0) {
      return serverEvidenceChain;
    }
    if (selectedTask == null) {
      return [];
    }
    const evidenceRefs = selectedTask.evidenceRefs;
    if (evidenceRefs == null || evidenceRefs.length === 0) {
      return [];
    }
    return evidenceRefs.map((entry, index) => {
      if (typeof entry === "string") {
        return {
          id: `${selectedTask.id}-evidence-${index + 1}`,
          type: "reference",
          description: entry
        };
      }
      return {
        id: entry.id ?? `${selectedTask.id}-evidence-${index + 1}`,
        type: entry.type ?? "reference",
        description: entry.description ?? entry.uri ?? `evidence:${index + 1}`
      };
    });
  }, [selectedTask, serverEvidenceChain]);
  const timelineEvents = useMemo(
    () => [...timelineItems, ...serverTimelineItems].map((item, index) => ({ id: `timeline-${index + 1}`, title: item.title, description: item.description })),
    [serverTimelineItems, timelineItems]
  );
  const stepOutputs = useMemo(
    () => drillDownSteps.filter((step) => selectedStepId == null || step.id === selectedStepId).map((step) => `${step.title} ${step.status} \xB7 ${step.executor ?? "unknown"}`),
    [drillDownSteps, selectedStepId]
  );
  const updateSelected = useCallback((body) => {
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
  const runTaskMutation = useCallback(async (body, title, description) => {
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
  const fetchTaskDrillDown = useCallback(async (taskId) => {
    const cockpit = await client.get(`/v1/tasks/${encodeURIComponent(taskId)}`);
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
  const selectTask = useCallback((id) => {
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
    selectedTask?.status
  ]);
  const runWorkflowMutation = useCallback(async (action, title, description) => {
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
  const createTaskFromPrompt = useCallback(async (input) => {
    const title = sanitizeTaskTitle(input.title);
    if (title.length === 0) {
      throw new Error("task.title_required");
    }
    const domainId = sanitizeInput(input.domainId, "platform");
    const owner = input.owner == null || input.owner.trim().length === 0 ? void 0 : sanitizeInput(input.owner, "platform-sre");
    const nextTask = {
      id: createLocalTaskId(title),
      title,
      status: "queued",
      domainId,
      currentStep: "intake",
      evidenceCount: 0,
      timelineDepth: 1,
      outputSummary: null,
      outputUri: null,
      ...owner == null ? {} : { owner }
    };
    const previousTasks = visibleTasks;
    const nextTasks = [nextTask, ...visibleTasks];
    setOptimisticTasks(nextTasks);
    queryClient.setQueryData(taskQueryKeys.tasks, nextTasks);
    setSelectedId(nextTask.id);
    setDrillDownSteps([]);
    setSelectedStepId(null);
    setServerEvidenceChain([]);
    setServerTimelineItems([]);
    setTimelineItems((current) => [
      { title: `Created \xB7 ${title}`, description: `Queued in ${domainId} from operator input.` },
      ...current
    ]);
    setPendingOperations((current) => current + 1);
    try {
      const created = await createTask(client, {
        title,
        divisionId: domainId,
        ...owner == null ? {} : { owner }
      });
      const createdTaskId = readCreatedTaskId(created);
      if (createdTaskId != null) {
        setOptimisticTasks((current) => current?.map((task) => task.id === nextTask.id ? { ...task, id: createdTaskId } : task) ?? current);
        setSelectedId(createdTaskId);
      }
      const refreshedTasks = await refreshTasks();
      setOptimisticTasks(null);
      const createdTask = (createdTaskId == null ? null : refreshedTasks.find((task) => task.id === createdTaskId) ?? null) ?? refreshedTasks.find((task) => task.title === title && task.domainId === domainId) ?? refreshedTasks[0] ?? null;
      setSelectedId(createdTask?.id ?? null);
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.tasks });
    } catch (error) {
      setOptimisticTasks(previousTasks);
      queryClient.setQueryData(taskQueryKeys.tasks, previousTasks);
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
      }
    },
    evidenceViewer: {
      evidenceChain,
      loading: loadingEvidence
    },
    timelineViewer: {
      timelineEvents,
      expandedEventId,
      expandEvent(eventId) {
        setExpandedEventId(eventId);
      }
    },
    selectTask,
    async claimTask(operator = "platform-sre") {
      const sanitizedOperator = sanitizeInput(operator, "platform-sre");
      await runTaskMutation(
        { owner: sanitizedOperator, status: "running" },
        `Take Over \xB7 ${selectedTask?.title ?? "task"}`,
        `${sanitizedOperator} claimed the task and resumed ownership.`
      );
    },
    async pauseTask() {
      await runWorkflowMutation(
        () => pauseWorkflowApi(client, selectedTask.id),
        `Paused \xB7 ${selectedTask?.title ?? "task"}`,
        "Paused by operator."
      );
    },
    async cancelTask() {
      await runWorkflowMutation(
        () => cancelWorkflow(client, selectedTask.id),
        `Cancelled \xB7 ${selectedTask?.title ?? "task"}`,
        "Cancelled by operator."
      );
    },
    async retryTask() {
      await runWorkflowMutation(
        () => recoverWorkflowApi(client, selectedTask.id),
        `Retry \xB7 ${selectedTask?.title ?? "task"}`,
        "Retry requested."
      );
    },
    async resumeTask(mode) {
      await runWorkflowMutation(
        () => resumeWorkflowApi(client, selectedTask.id, mode === "supervised" ? "supervised" : "normal"),
        `Resume \xB7 ${selectedTask?.title ?? "task"}`,
        `${mode} resume requested.`
      );
    },
    async escalateTask(target = "domain-admin") {
      const sanitizedTarget = sanitizeInput(target, "domain-admin");
      await runTaskMutation(
        { status: "blocked" },
        `Escalated \xB7 ${selectedTask?.title ?? "task"}`,
        `Escalated to ${sanitizedTarget}.`
      );
    },
    fetchTaskDrillDown,
    createTaskFromPrompt,
    async refreshTasks() {
      await refreshTasks();
    }
  };
}
export {
  mapTasksToVm,
  useTaskCockpitVm
};
