import { useCallback, useEffect, useMemo, useState } from "react";
import { useTasksQuery, useRestClient } from "@aa/shared-state";
import type { TaskDTO, WorkflowRunStepDTO } from "@aa/shared-types";
import { updateTask, fetchWorkflowRunSteps } from "@aa/shared-api-client";

// L3: StepOutputViewer - displays execution step outputs
export interface StepOutputViewerVm {
  readonly steps: readonly WorkflowRunStepDTO[];
  readonly selectedStep: WorkflowRunStepDTO | null;
  readonly stepOutputs: readonly { key: string; value: string }[];
  selectStep(stepId: string): void;
}

// L4: EvidenceChainViewer - displays evidence chain for a task
export interface EvidenceChainViewerVm {
  readonly evidenceChain: readonly { id: string; type: string; timestamp: string; description: string }[];
  readonly loading: boolean;
}

// L5: TimelineViewer - displays execution timeline with all events
export interface TimelineViewerVm {
  readonly timelineEvents: readonly {
    id: string;
    title: string;
    description: string;
    timestamp: string;
    type: "create" | "update" | "transition" | "checkpoint" | "recovery";
  }[];
  readonly expandedEventId: string | null;
  expandEvent(id: string): void;
}

export interface TaskCockpitVm {
  readonly tasks: readonly TaskDTO[];
  readonly listItems: readonly { id: string; title: string; subtitle: string }[];
  readonly selectedId: string | null;
  readonly selectedTask: TaskDTO | null;
  // L1-L2 basic fields
  readonly timelineItems: readonly { title: string; description: string }[];
  readonly pendingAction: boolean;
  // L3 StepOutputViewer
  readonly stepViewer: StepOutputViewerVm;
  // L4 EvidenceChainViewer
  readonly evidenceViewer: EvidenceChainViewerVm;
  // L5 TimelineViewer
  readonly timelineViewer: TimelineViewerVm;
  selectTask(id: string): void;
  claimTask(operator: string): Promise<void>;
  resumeTask(mode: "normal" | "supervised"): Promise<void>;
  escalateTask(target: string): Promise<void>;
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
  const client = useRestClient();
  // §2268: Enable polling with refetchInterval for real-time monitoring (5 second interval)
  const queryTasks = useTasksQuery(undefined, { refetchInterval: 5000 }).data ?? [];
  const [tasks, setTasks] = useState<readonly TaskDTO[]>(queryTasks);
  // §2268/2271: Start with null selection - do not auto-select until user picks a task
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timelineItems, setTimelineItems] = useState<readonly { title: string; description: string }[]>([]);
  const [pendingAction, setPendingAction] = useState(false);

  // L3: StepOutputViewer state
  const [steps, setSteps] = useState<readonly WorkflowRunStepDTO[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [stepsLoading, setStepsLoading] = useState(false);

  // L4: EvidenceChainViewer state
  const [evidenceChain, setEvidenceChain] = useState<readonly { id: string; type: string; timestamp: string; description: string }[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  // L5: TimelineViewer state
  const [timelineEvents, setTimelineEvents] = useState<readonly {
    id: string;
    title: string;
    description: string;
    timestamp: string;
    type: "create" | "update" | "transition" | "checkpoint" | "recovery";
  }[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  useEffect(() => {
    setTasks(queryTasks);
    // §2268/2271: Sync selectedId only if current selection is not in the updated task list
    // Don't auto-select first task on every poll - preserves user's explicit selection
    setSelectedId((current) => {
      if (current === null || !queryTasks.some((t) => t.id === current)) {
        return null;
      }
      return current;
    });
  }, [queryTasks]);

  const baseVm = useMemo(() => mapTasksToVm(tasks), [tasks]);
  // §2271: selectedTask must match selectedId - no fallback to tasks[0] which causes ghost selection
  const selectedTask = tasks.find((task) => task.id === selectedId) ?? null;

  // Load L3 steps when selectedTask changes - use currentStep as reference to fetch steps
  useEffect(() => {
    if (selectedTask == null) {
      setSteps([]);
      setSelectedStepId(null);
      return;
    }
    // Use currentStep to derive workflow reference - in real impl this would be a separate field
    const workflowRef = selectedTask.currentStep;
    if (!workflowRef) {
      setSteps([]);
      setSelectedStepId(null);
      return;
    }
    setStepsLoading(true);
    setEvidenceLoading(true);
    // Fetch workflow steps using a derived ID from currentStep
    // In production this would be fetched via proper workflowRunId on TaskDTO
    void fetchWorkflowRunSteps(client, workflowRef).then((fetchedSteps) => {
      setSteps(fetchedSteps);
      setSelectedStepId(fetchedSteps[0]?.id ?? null);
      setStepsLoading(false);
      // L4: Build evidence chain from fetched steps
      setEvidenceChain(fetchedSteps.map((step) => ({
        id: step.id,
        type: step.status === "completed" ? "checkpoint" : "pending",
        timestamp: step.startedAt ?? new Date().toISOString(),
        description: `Step: ${step.title} — ${step.status}`,
      })));
      setEvidenceLoading(false);
    }).catch(() => {
      setStepsLoading(false);
      setEvidenceLoading(false);
    });
  }, [client, selectedTask?.currentStep]);

  function updateSelected(transform: (task: TaskDTO) => TaskDTO, title: string, description: string): void {
    if (selectedTask == null) {
      return;
    }
    setTasks((current) => current.map((task) => task.id === selectedTask.id ? transform(task) : task));
    // §2275: Limit timelineItems to 100 entries to prevent unbounded growth
    setTimelineItems((current) => [{ title, description }, ...current].slice(0, 100));
  }

  // L5 Timeline update helper
  function addTimelineEvent(type: TimelineViewerVm["timelineEvents"][number]["type"], title: string, description: string): void {
    const event = {
      id: `evt-${Date.now()}`,
      title,
      description,
      timestamp: new Date().toISOString(),
      type,
    };
    setTimelineEvents((prev) => [event, ...prev]);
  }

  const claimTask = useCallback(async (operator: string): Promise<void> => {
    if (selectedTask == null) return;
    setPendingAction(true);
    const previousTasks = tasks;
    const previousTimelineItems = timelineItems;
    const previousTimelineEvents = timelineEvents;
    try {
      updateSelected(
        (task) => ({ ...task, owner: operator, status: "running" }),
        `Takeover · ${selectedTask.title}`,
        `${operator} claimed the task and resumed ownership.`,
      );
      addTimelineEvent("recovery", `Takeover · ${selectedTask.title}`, `${operator} claimed the task.`);
      await updateTask(client, selectedTask.id, { owner: operator, status: "running" });
    } catch (error) {
      setTasks(previousTasks);
      setTimelineItems(previousTimelineItems);
      setTimelineEvents(previousTimelineEvents);
      throw error;
    } finally {
      setPendingAction(false);
    }
  }, [client, selectedTask, tasks, timelineEvents, timelineItems]);

  const resumeTask = useCallback(async (mode: "normal" | "supervised"): Promise<void> => {
    if (selectedTask == null) return;
    setPendingAction(true);
    const previousTasks = tasks;
    const previousTimelineItems = timelineItems;
    const previousTimelineEvents = timelineEvents;
    try {
      updateSelected(
        (task) => ({ ...task, status: "running", currentStep: mode === "supervised" ? "supervised-resume" : "resume" }),
        `Resume · ${selectedTask.title}`,
        `${mode} mode resume was requested through HITL.`,
      );
      addTimelineEvent("recovery", `Resume · ${selectedTask.title}`, `${mode} mode resume requested.`);
      await updateTask(client, selectedTask.id, {
        status: "running",
        currentStep: mode === "supervised" ? "supervised-resume" : "resume",
      });
    } catch (error) {
      setTasks(previousTasks);
      setTimelineItems(previousTimelineItems);
      setTimelineEvents(previousTimelineEvents);
      throw error;
    } finally {
      setPendingAction(false);
    }
  }, [client, selectedTask, tasks, timelineEvents, timelineItems]);

  const escalateTask = useCallback(async (target: string): Promise<void> => {
    if (selectedTask == null) return;
    setPendingAction(true);
    const previousTasks = tasks;
    const previousTimelineItems = timelineItems;
    const previousTimelineEvents = timelineEvents;
    try {
      updateSelected(
        (task) => ({ ...task, status: "blocked", currentStep: `escalated:${target}` }),
        `Escalated · ${selectedTask.title}`,
        `Task was escalated to ${target} for review.`,
      );
      addTimelineEvent("transition", `Escalated · ${selectedTask.title}`, `Task escalated to ${target}.`);
      await updateTask(client, selectedTask.id, {
        status: "blocked",
        currentStep: `escalated:${target}`,
      });
    } catch (error) {
      setTasks(previousTasks);
      setTimelineItems(previousTimelineItems);
      setTimelineEvents(previousTimelineEvents);
      throw error;
    } finally {
      setPendingAction(false);
    }
  }, [client, selectedTask, tasks, timelineEvents, timelineItems]);

  // L3 StepOutputViewer helpers
  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? null;
  const stepOutputs: readonly { key: string; value: string }[] = selectedStep
    ? [
        { key: "Title", value: selectedStep.title },
        { key: "Status", value: selectedStep.status },
        { key: "Started At", value: selectedStep.startedAt ?? "—" },
        { key: "Completed At", value: selectedStep.completedAt ?? "—" },
      ]
    : [];

  const stepViewer: StepOutputViewerVm = {
    steps,
    selectedStep,
    stepOutputs,
    selectStep(stepId: string) {
      setSelectedStepId(stepId);
    },
  };

  // L4 EvidenceChainViewer
  const evidenceViewer: EvidenceChainViewerVm = {
    evidenceChain,
    loading: evidenceLoading,
  };

  // L5 TimelineViewer
  const timelineViewer: TimelineViewerVm = {
    timelineEvents,
    expandedEventId,
    expandEvent(id: string) {
      setExpandedEventId((prev) => (prev === id ? null : id));
    },
  };

  return {
    ...baseVm,
    selectedId,
    selectedTask,
    timelineItems,
    pendingAction,
    stepViewer,
    evidenceViewer,
    timelineViewer,
    selectTask(id: string) {
      setSelectedId(id);
    },
    claimTask,
    resumeTask,
    escalateTask,
  };
}
