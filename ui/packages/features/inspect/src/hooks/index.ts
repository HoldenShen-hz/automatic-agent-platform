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
  readonly recentEvents?: readonly { id?: string; type?: string; createdAt?: string; at?: string; summary?: string; name?: string }[];
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
  return [
    { key: "Task", value: task.title },
    { key: "Status", value: task.status },
    { key: "Domain", value: task.domainId },
    { key: "Current Step", value: task.currentStep },
    { key: "Workflow Status", value: inspectView?.workflowState?.status ?? "unknown" },
    { key: "Execution Trace", value: inspectView?.execution?.traceId ?? "none" },
    { key: "Execution Status", value: inspectView?.execution?.status ?? "unknown" },
    { key: "Model", value: model },
    { key: "Execution Mode", value: task.executionMode ?? translateMessage("ui.taskCockpit.value.unknown") },
  ];
}

export function useInspectVm(): InspectVm {
  const client = useRestClient();
  const taskQuery = useTasksQuery({ refetchInterval: 5000 });
  const tasks = taskQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectView, setInspectView] = useState<InspectResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (tasks.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (
      current != null && tasks.some((task) => task.id === current)
        ? current
        : tasks[0]?.id ?? null
    ));
  }, [tasks]);

  const selectedTask = tasks.find((task) => task.id === selectedId) ?? null;

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
      { label: "Tasks", value: tasks.length },
      { label: "Pending Approvals", value: approvals.filter((approval) => approval.status === "requested" || approval.status === "pending").length },
      { label: "Recent Events", value: recentEvents.length },
    ],
    listItems: tasks.map((task) => ({
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
        title: event.summary ?? event.name ?? event.type ?? `event-${index + 1}`,
        description: event.createdAt ?? event.at ?? "unknown",
      })),
    loading: taskQuery.isLoading && tasks.length === 0,
    loadError,
    selectTask(taskId: string) {
      setSelectedId(taskId);
    },
  };
}
