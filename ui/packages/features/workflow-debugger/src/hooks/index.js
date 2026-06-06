import { useCallback, useEffect, useMemo, useState } from "react";
import { copyTextToClipboard } from "@aa/shared-platform";
import { useRestClient, useTasksQuery } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
const DEBUGGER_TASK_PRIORITY = {
    failed: 0,
    running: 1,
    queued: 2,
    paused: 3,
    awaiting_input: 4,
    done: 5,
    completed: 5,
    cancelled: 6,
    canceled: 6,
};
function resolveDebuggerTaskPriority(task) {
    return DEBUGGER_TASK_PRIORITY[task.status] ?? 7;
}
export function prioritizeDebuggerTasks(tasks) {
    return [...tasks].sort((left, right) => {
        const priorityDiff = resolveDebuggerTaskPriority(left) - resolveDebuggerTaskPriority(right);
        if (priorityDiff !== 0) {
            return priorityDiff;
        }
        return right.id.localeCompare(left.id);
    });
}
function mapTaskToListItem(task) {
    return {
        id: task.id,
        title: task.title,
        subtitle: `${task.status} · ${task.domainId}`,
    };
}
function buildDetailRows(task) {
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
        { key: "Model", value: model },
        { key: "Execution Mode", value: task.executionMode ?? translateMessage("ui.taskCockpit.value.unknown") },
    ];
}
function buildTimelineItems(debugView) {
    const entries = debugView?.timeline?.entries ?? [];
    if (entries.length > 0) {
        return entries.map((entry) => ({
            title: entry.title,
            description: `${entry.occurredAt} · ${entry.summary}`,
        }));
    }
    const stepOutputs = debugView?.inspect?.stepOutputs ?? [];
    return stepOutputs.map((step, index) => ({
        title: step.summary ?? step.stepId ?? `step-${index + 1}`,
        description: `${step.status ?? "pending"} · ${step.producedAt ?? "unknown"}`,
    }));
}
function buildFailureItems(task, debugView) {
    const stepOutputs = (debugView?.inspect?.stepOutputs ?? []).filter((step) => step.status === "failed");
    if (stepOutputs.length > 0) {
        return stepOutputs.map((step, index) => ({
            title: step.summary ?? step.stepId ?? `failed-step-${index + 1}`,
            description: `${step.roleId ?? "unknown"} · ${step.producedAt ?? "unknown"}`,
        }));
    }
    if (task?.status === "failed") {
        return [
            {
                title: task.currentStep,
                description: task.outputSummary ?? "Task failed without a structured step output.",
            },
        ];
    }
    return [
        {
            title: "No failure detected",
            description: "The selected task has no failed step outputs.",
        },
    ];
}
function buildExportSnapshot(task, debugView) {
    if (task == null) {
        return "";
    }
    return JSON.stringify({
        task,
        inspect: debugView?.inspect ?? null,
        timeline: debugView?.timeline ?? null,
    }, null, 2);
}
export function useWorkflowDebuggerVm() {
    const client = useRestClient();
    const taskQuery = useTasksQuery({ refetchInterval: 5000 });
    const tasks = useMemo(() => prioritizeDebuggerTasks(taskQuery.data ?? []), [taskQuery.data]);
    const [selectedId, setSelectedId] = useState(null);
    const [debugView, setDebugView] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [pendingOperations, setPendingOperations] = useState(0);
    const [activityItems, setActivityItems] = useState([]);
    const [activePanel, setActivePanel] = useState("timeline");
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
    const loadDebugView = useCallback(async (taskId) => {
        const response = await client.get(`/v1/tasks/${encodeURIComponent(taskId)}`);
        setDebugView(response);
        setLoadError(null);
        return response;
    }, [client]);
    useEffect(() => {
        if (selectedId == null) {
            setDebugView(null);
            return;
        }
        void loadDebugView(selectedId).catch((error) => {
            setLoadError(error instanceof Error ? error.message : String(error));
            setDebugView(null);
        });
    }, [loadDebugView, selectedId, selectedTask?.status, selectedTask?.currentStep, selectedTask?.outputSummary]);
    const withPending = useCallback(async (operation) => {
        setPendingOperations((current) => current + 1);
        try {
            await operation();
        }
        finally {
            setPendingOperations((current) => Math.max(0, current - 1));
        }
    }, []);
    const appendActivity = useCallback((title, description) => {
        setActivityItems((current) => [{ title, description }, ...current]);
    }, []);
    const replayTimeline = useCallback(async () => {
        if (selectedTask == null) {
            return;
        }
        await withPending(async () => {
            await loadDebugView(selectedTask.id);
            setActivePanel("timeline");
            appendActivity("Timeline replay refreshed", `${selectedTask.title} timeline was refreshed from the task cockpit API.`);
        });
    }, [appendActivity, loadDebugView, selectedTask, withPending]);
    const focusFailure = useCallback(async () => {
        if (selectedTask == null) {
            return;
        }
        await withPending(async () => {
            await loadDebugView(selectedTask.id);
            setActivePanel("failure");
            appendActivity("Failure focus updated", `${selectedTask.title} failure view was rebuilt from live task inspect data.`);
        });
    }, [appendActivity, loadDebugView, selectedTask, withPending]);
    const exportDebugSnapshot = useCallback(async () => {
        if (selectedTask == null) {
            return;
        }
        await withPending(async () => {
            const latest = await loadDebugView(selectedTask.id);
            const payload = buildExportSnapshot(selectedTask, latest);
            try {
                await copyTextToClipboard(payload);
                setActivePanel("export");
                appendActivity("Debug snapshot exported", `${selectedTask.title} snapshot was generated from live task inspect and timeline data.`);
            }
            catch (error) {
                setActivePanel("export");
                appendActivity("Debug snapshot export failed", error instanceof Error ? error.message : String(error));
            }
        });
    }, [appendActivity, loadDebugView, selectedTask, withPending]);
    const metrics = useMemo(() => {
        const stepOutputs = debugView?.inspect?.stepOutputs ?? [];
        return [
            { label: "Tasks", value: tasks.length },
            { label: "Failed Steps", value: stepOutputs.filter((step) => step.status === "failed").length },
            { label: "Timeline Events", value: debugView?.timeline?.entries?.length ?? 0 },
        ];
    }, [debugView, tasks.length]);
    return {
        loading: taskQuery.isLoading && tasks.length === 0,
        selectedId,
        selectedTask,
        tasks,
        listItems: tasks.map(mapTaskToListItem),
        detailRows: buildDetailRows(selectedTask),
        metrics,
        activityItems,
        activePanel,
        timelineItems: buildTimelineItems(debugView),
        failureItems: buildFailureItems(selectedTask, debugView),
        exportSnapshot: buildExportSnapshot(selectedTask, debugView),
        loadError: loadError ?? (taskQuery.error instanceof Error ? taskQuery.error.message : null),
        pendingOperations,
        selectTask(taskId) {
            setSelectedId(taskId);
        },
        replayTimeline,
        focusFailure,
        exportDebugSnapshot,
    };
}
