import { useCallback, useEffect, useMemo, useState } from "react";
import { useRestClient, useTasksQuery } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
import type { TaskDTO } from "@aa/shared-types";

type InspectResponse = {
  readonly workflowState?: {
    readonly status?: string | null;
    readonly currentStepIndex?: number | null;
    readonly lastErrorCode?: string | null;
  };
  readonly execution?: {
    readonly traceId?: string | null;
    readonly status?: string | null;
  };
  readonly approvals?: readonly { id: string; status?: string; decisionType?: string }[];
  readonly operatorActions?: readonly { id?: string; actionType?: string; actorId?: string; createdAt?: string }[];
  readonly dispatchDecisions?: readonly { decisionId?: string; outcome?: string; selectedWorkerPlacement?: string | null; remoteAvailability?: string | null }[];
  readonly runtimeRecovery?: {
    readonly candidates?: readonly { suggestedAction?: string; reason?: string }[];
  };
  readonly recentEvents?: readonly {
    id?: string;
    type?: string;
    eventType?: string;
    createdAt?: string;
    at?: string;
    summary?: string;
    name?: string;
    traceId?: string | null;
  }[];
};

type InspectListItem = {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
};

type InspectDetailRow = {
  readonly key: string;
  readonly value: string;
};

function getInspectTaskPriority(task: TaskDTO): number {
  switch (task.status) {
    case "failed":
      return 0;
    case "running":
      return 1;
    case "paused":
      return 2;
    case "queued":
      return 3;
    default:
      return 4;
  }
}

function sortInspectTasks(tasks: readonly TaskDTO[]): readonly TaskDTO[] {
  return [...tasks].sort((left, right) => getInspectTaskPriority(left) - getInspectTaskPriority(right));
}

export interface InspectVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly listItems: readonly InspectListItem[];
  readonly selectedId: string | null;
  readonly detailRows: readonly InspectDetailRow[];
  readonly summaryItems: readonly { title: string; description: string }[];
  readonly approvalItems: readonly { title: string; description: string }[];
  readonly eventItems: readonly { title: string; description: string }[];
  readonly loading: boolean;
  readonly loadError: string | null;
  selectTask(taskId: string): void;
}

function buildDetailRows(task: TaskDTO | null, inspectView: InspectResponse | null): readonly InspectDetailRow[] {
  if (task == null) {
    return [];
  }
  const model = task.modelProvider == null && task.modelName == null
    ? translateMessage("ui.taskCockpit.value.unknown")
    : `${task.modelProvider ?? "unknown"} / ${task.modelName ?? "unknown"}`;
  const traceId = resolveInspectTraceId(inspectView);
  const executionStatus = inspectView?.execution?.status ?? task.modelCallStatus ?? "unknown";
  return [
    { key: "Task", value: task.title },
    { key: "Status", value: task.status },
    { key: "Domain", value: task.domainId },
    { key: "Current Step", value: task.currentStep },
    { key: "Workflow Status", value: inspectView?.workflowState?.status ?? "unknown" },
    { key: "Execution Trace", value: traceId },
    { key: "Execution Status", value: executionStatus },
    { key: "Model", value: model },
    { key: "Execution Mode", value: task.executionMode ?? translateMessage("ui.taskCockpit.value.unknown") },
  ];
}

function resolveInspectTraceId(inspectView: InspectResponse | null): string {
  const executionTraceId = inspectView?.execution?.traceId;
  if (typeof executionTraceId === "string" && executionTraceId.trim().length > 0) {
    return executionTraceId;
  }
  const eventTraceId = inspectView?.recentEvents?.find(
    (event) => typeof event.traceId === "string" && event.traceId.trim().length > 0,
  )?.traceId;
  if (typeof eventTraceId === "string" && eventTraceId.trim().length > 0) {
    return eventTraceId;
  }
  return "none";
}

export function useInspectVm(): InspectVm {
  const client = useRestClient();
  const taskQuery = useTasksQuery({ refetchInterval: 5000 });
  const tasks = taskQuery.data ?? [];
  const orderedTasks = useMemo(() => sortInspectTasks(tasks), [tasks]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectView, setInspectView] = useState<InspectResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (orderedTasks.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (
      current != null && orderedTasks.some((task) => task.id === current)
        ? current
        : orderedTasks[0]?.id ?? null
    ));
  }, [orderedTasks]);

  const selectedTask = orderedTasks.find((task) => task.id === selectedId) ?? null;

  const loadInspectView = useCallback(async (taskId: string) => {
    const response = await client.get<InspectResponse>(`/v1/tasks/${encodeURIComponent(taskId)}/inspect`);
    setInspectView(response);
    setLoadError(null);
  }, [client]);

  useEffect(() => {
    if (selectedId == null) {
      setInspectView(null);
      return;
    }
    void loadInspectView(selectedId).catch((error: unknown) => {
      setInspectView(null);
      setLoadError(error instanceof Error ? error.message : String(error));
    });
  }, [loadInspectView, selectedId, selectedTask?.status, selectedTask?.currentStep, selectedTask?.outputSummary]);

  const approvals = inspectView?.approvals ?? [];
  const recentEvents = inspectView?.recentEvents ?? [];

  return {
    metrics: [
      { label: "Tasks", value: orderedTasks.length },
      { label: "Pending Approvals", value: approvals.filter((approval) => approval.status === "requested" || approval.status === "pending").length },
      { label: "Recent Events", value: recentEvents.length },
    ],
    listItems: orderedTasks.map((task) => ({
      id: task.id,
      title: task.title,
      subtitle: `${task.status} · ${task.domainId}`,
    })),
    selectedId,
    detailRows: buildDetailRows(selectedTask, inspectView),
    summaryItems: useMemo(() => [
      {
        title: "Inspect feed",
        description: selectedTask == null
          ? "No task inspect snapshot is selected."
          : `${selectedTask.title} inspect data is loaded from the real task inspect route.`,
      },
      {
        title: "Recovery recommendation",
        description: inspectView?.runtimeRecovery?.candidates?.[0]?.suggestedAction ?? "No recovery recommendation published.",
      },
      {
        title: "Dispatch insight",
        description: inspectView?.dispatchDecisions?.[0] == null
          ? "No dispatch decisions recorded."
          : `${inspectView.dispatchDecisions[0].outcome ?? "unknown"} via ${inspectView.dispatchDecisions[0].selectedWorkerPlacement ?? "unknown"} placement.`,
      },
    ], [inspectView, selectedTask]),
    approvalItems: approvals.length === 0
      ? [{ title: "No approvals", description: "The selected task has no approval records in its inspect snapshot." }]
      : approvals.map((approval) => ({
        title: `${approval.decisionType ?? "approval"} · ${approval.status ?? "unknown"}`,
        description: approval.id,
      })),
    eventItems: recentEvents.length === 0
      ? [{ title: "No recent events", description: "The selected task did not return recent inspect events." }]
      : recentEvents.slice(0, 8).map((event, index) => ({
        title: event.summary ?? event.name ?? event.type ?? event.eventType ?? `event-${index + 1}`,
        description: event.createdAt ?? event.at ?? "unknown",
      })),
    loading: taskQuery.isLoading && tasks.length === 0,
    loadError,
    selectTask(taskId: string) {
      setSelectedId(taskId);
    },
  };
}
