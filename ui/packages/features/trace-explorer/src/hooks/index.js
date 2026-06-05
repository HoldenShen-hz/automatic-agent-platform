import { useCallback, useEffect, useMemo, useState } from "react";
import { useRestClient, useTasksQuery } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
function buildDetailRows(task, traceView) {
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
        { key: "Trace ID", value: traceView?.inspect?.execution?.traceId ?? "none" },
        { key: "Timeline Events", value: String(traceView?.timeline?.entries?.length ?? 0) },
        { key: "Artifacts", value: String(traceView?.inspect?.artifacts?.length ?? 0) },
        { key: "Model", value: model },
        { key: "Execution Mode", value: task.executionMode ?? translateMessage("ui.taskCockpit.value.unknown") },
    ];
}
export function useTraceExplorerVm() {
    const client = useRestClient();
    const taskQuery = useTasksQuery({ refetchInterval: 5000 });
    const tasks = taskQuery.data ?? [];
    const [selectedId, setSelectedId] = useState(null);
    const [traceView, setTraceView] = useState(null);
    const [loadError, setLoadError] = useState(null);
    useEffect(() => {
        if (tasks.length === 0) {
            setSelectedId(null);
            return;
        }
        setSelectedId((current) => (current != null && tasks.some((task) => task.id === current)
            ? current
            : tasks[0]?.id ?? null));
    }, [tasks]);
    const selectedTask = tasks.find((task) => task.id === selectedId) ?? null;
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
    const restrictedItems = timelineEntries
        .filter((entry) => /restricted|denied|blocked/i.test(`${entry.title} ${entry.summary}`))
        .map((entry) => ({
        title: entry.title,
        description: `${entry.occurredAt} · ${entry.summary}`,
    }));
    return {
        metrics: [
            { label: "Tasks", value: tasks.length },
            { label: "Timeline Events", value: timelineEntries.length },
            { label: "Restricted Signals", value: restrictedItems.length },
        ],
        listItems: tasks.map((task) => ({
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
                description: timelineEntries[0] == null
                    ? "No timeline events were returned for the selected task."
                    : `${timelineEntries[0].title} @ ${timelineEntries[0].occurredAt}.`,
            },
            {
                title: "Contract boundary",
                description: "Trace export bundles and restricted-event pivot APIs still need dedicated observability routes.",
            },
        ], [selectedTask, timelineEntries]),
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
