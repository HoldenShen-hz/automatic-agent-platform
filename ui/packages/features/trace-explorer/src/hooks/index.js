import { useCallback, useEffect, useMemo, useState } from "react";
import { useRestClient, useTasksQuery } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
function getTraceTaskPriority(task) {
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
function sortTraceTasks(tasks) {
    return [...tasks].sort((left, right) => getTraceTaskPriority(left) - getTraceTaskPriority(right));
}
function buildDetailRows(task, traceView) {
    if (task == null) {
        return [];
    }
    const model = task.modelProvider == null && task.modelName == null
        ? translateMessage("ui.taskCockpit.value.unknown")
        : `${task.modelProvider ?? "unknown"} / ${task.modelName ?? "unknown"}`;
    const traceId = resolveTraceId(traceView);
    return [
        { key: "Task", value: task.title },
        { key: "Status", value: task.status },
        { key: "Domain", value: task.domainId },
        { key: "Trace ID", value: traceId },
        { key: "Timeline Events", value: String(traceView?.timeline?.entries?.length ?? 0) },
        { key: "Artifacts", value: String(traceView?.inspect?.artifacts?.length ?? 0) },
        { key: "Model", value: model },
        { key: "Execution Mode", value: task.executionMode ?? translateMessage("ui.taskCockpit.value.unknown") },
    ];
}
function resolveTraceId(traceView) {
    const executionTraceId = traceView?.inspect?.execution?.traceId;
    if (typeof executionTraceId === "string" && executionTraceId.trim().length > 0) {
        return executionTraceId;
    }
    const timelineTraceId = traceView?.timeline?.entries?.find((entry) => typeof entry.traceId === "string" && entry.traceId.trim().length > 0)?.traceId;
    if (typeof timelineTraceId === "string" && timelineTraceId.trim().length > 0) {
        return timelineTraceId;
    }
    return "none";
}
export function useTraceExplorerVm() {
    const client = useRestClient();
    const taskQuery = useTasksQuery({ refetchInterval: 5000 });
    const tasks = taskQuery.data ?? [];
    const orderedTasks = useMemo(() => sortTraceTasks(tasks), [tasks]);
    const [selectedId, setSelectedId] = useState(null);
    const [traceView, setTraceView] = useState(null);
    const [loadError, setLoadError] = useState(null);
    useEffect(() => {
        if (orderedTasks.length === 0) {
            setSelectedId(null);
            return;
        }
        setSelectedId((current) => (current != null && orderedTasks.some((task) => task.id === current)
            ? current
            : orderedTasks[0]?.id ?? null));
    }, [orderedTasks]);
    const selectedTask = orderedTasks.find((task) => task.id === selectedId) ?? null;
    const loadTraceView = useCallback(async (taskId) => {
        const response = await client.get(`/v1/tasks/${encodeURIComponent(taskId)}`);
        setTraceView(response);
        setLoadError(null);
    }, [client]);
    useEffect(() => {
        if (selectedId == null) {
            setTraceView(null);
            return;
        }
        void loadTraceView(selectedId).catch((error) => {
            setTraceView(null);
            setLoadError(error instanceof Error ? error.message : String(error));
        });
    }, [loadTraceView, selectedId, selectedTask?.status, selectedTask?.currentStep, selectedTask?.outputSummary]);
    const timelineEntries = traceView?.timeline?.entries ?? [];
    const latestTimelineEntry = timelineEntries.at(-1) ?? null;
    const restrictedItems = timelineEntries
        .filter((entry) => /restricted|denied|blocked/i.test(`${entry.title} ${entry.summary}`))
        .map((entry) => ({
        title: entry.title,
        description: `${entry.occurredAt} · ${entry.summary}`,
    }));
    return {
        metrics: [
            { label: "Tasks", value: orderedTasks.length },
            { label: "Timeline Events", value: timelineEntries.length },
            { label: "Restricted Signals", value: restrictedItems.length },
        ],
        listItems: orderedTasks.map((task) => ({
            id: task.id,
            title: task.title,
            subtitle: `${task.status} · ${task.domainId}`,
        })),
        selectedId,
        detailRows: buildDetailRows(selectedTask, traceView),
        summaryItems: useMemo(() => [
            {
                title: "Trace feed",
                description: selectedTask == null
                    ? "No trace view is selected."
                    : `${selectedTask.title} timeline is loaded from the real task trace route.`,
            },
            {
                title: "Latest trace",
                description: latestTimelineEntry == null
                    ? "No timeline events were returned for the selected task."
                    : `${latestTimelineEntry.title} @ ${latestTimelineEntry.occurredAt}.`,
            },
            {
                title: "Contract boundary",
                description: "Trace export bundles and restricted-event pivot APIs still need dedicated observability routes.",
            },
        ], [latestTimelineEntry, selectedTask]),
        timelineItems: timelineEntries.length === 0
            ? [{ title: "No timeline events", description: "The selected task did not return any trace timeline entries." }]
            : timelineEntries.slice(0, 10).map((entry) => ({
                title: entry.title,
                description: `${entry.occurredAt} · ${entry.summary}`,
            })),
        restrictedItems: restrictedItems.length === 0
            ? [{ title: "No restricted signals", description: "The selected task timeline did not report restricted or blocked trace events." }]
            : restrictedItems,
        loading: taskQuery.isLoading && tasks.length === 0,
        loadError,
        selectTask(taskId) {
            setSelectedId(taskId);
        },
    };
}
