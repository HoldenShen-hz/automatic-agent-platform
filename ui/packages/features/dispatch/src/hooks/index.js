import { useCallback, useEffect, useMemo, useState } from "react";
import { useRestClient, useTasksQuery, useWorkflowsQuery } from "@aa/shared-state";
function buildDetailRows(task, inspectView) {
    if (task == null) {
        return [];
    }
    const latestDecision = inspectView?.dispatchDecisions?.[0] ?? null;
    return [
        { key: "Task", value: task.title },
        { key: "Status", value: task.status },
        { key: "Domain", value: task.domainId },
        { key: "Current Step", value: task.currentStep },
        { key: "Latest Dispatch Outcome", value: latestDecision?.outcome ?? "none" },
        { key: "Worker Placement", value: latestDecision?.selectedWorkerPlacement ?? "unknown" },
        { key: "Remote Availability", value: latestDecision?.remoteAvailability ?? "unknown" },
        { key: "Selected Worker", value: latestDecision?.selectedWorkerId ?? "none" },
    ];
}
function mapWorkflowToSummary(workflow) {
    return {
        title: `${workflow.title} · ${workflow.status}`,
        description: `${workflow.currentStage} · ${workflow.owner}`,
    };
}
export function useDispatchVm() {
    const client = useRestClient();
    const taskQuery = useTasksQuery({ refetchInterval: 5000 });
    const workflowQuery = useWorkflowsQuery();
    const tasks = taskQuery.data ?? [];
    const workflows = workflowQuery.data ?? [];
    const [selectedId, setSelectedId] = useState(null);
    const [inspectView, setInspectView] = useState(null);
    const [loadError, setLoadError] = useState(null);
    useEffect(() => {
        if (tasks.length === 0) {
            setSelectedId(null);
            return;
        }
        const orderedTasks = [...tasks].sort((left, right) => {
            const leftWeight = left.status === "running" ? 0 : left.status === "failed" ? 1 : 2;
            const rightWeight = right.status === "running" ? 0 : right.status === "failed" ? 1 : 2;
            return leftWeight - rightWeight;
        });
        setSelectedId((current) => (current != null && orderedTasks.some((task) => task.id === current)
            ? current
            : orderedTasks[0]?.id ?? null));
    }, [tasks]);
    const selectedTask = tasks.find((task) => task.id === selectedId) ?? null;
    const loadInspectView = useCallback(async (taskId) => {
        const response = await client.get(`/v1/tasks/${encodeURIComponent(taskId)}/inspect`);
        setInspectView(response);
        setLoadError(null);
    }, [client]);
    useEffect(() => {
        if (selectedId == null) {
            setInspectView(null);
            return;
        }
        void loadInspectView(selectedId).catch((error) => {
            setInspectView(null);
            setLoadError(error instanceof Error ? error.message : String(error));
        });
    }, [loadInspectView, selectedId, selectedTask?.status, selectedTask?.currentStep, selectedTask?.outputSummary]);
    const approvals = inspectView?.approvals ?? [];
    return {
        metrics: [
            { label: "Tasks", value: tasks.length },
            { label: "Running Tasks", value: tasks.filter((task) => task.status === "running").length },
            { label: "Running Workflows", value: workflows.filter((workflow) => workflow.status === "running").length },
        ],
        listItems: [...tasks]
            .sort((left, right) => {
            const leftWeight = left.status === "running" ? 0 : left.status === "failed" ? 1 : 2;
            const rightWeight = right.status === "running" ? 0 : right.status === "failed" ? 1 : 2;
            return leftWeight - rightWeight;
        })
            .map((task) => ({
            id: task.id,
            title: task.title,
            subtitle: `${task.status} · ${task.domainId}`,
        })),
        selectedId,
        detailRows: buildDetailRows(selectedTask, inspectView),
        summaryItems: useMemo(() => [
            {
                title: "Dispatch feed",
                description: selectedTask == null
                    ? "No task is selected for dispatch inspection."
                    : `${selectedTask.title} dispatch view is loaded from real task and inspect APIs.`,
            },
            {
                title: "Latest decision",
                description: inspectView?.dispatchDecisions?.[0] == null
                    ? "No dispatch decisions were recorded for the selected task."
                    : `${inspectView.dispatchDecisions[0].outcome ?? "unknown"} via ${inspectView.dispatchDecisions[0].selectedWorkerPlacement ?? "unknown"}.`,
            },
            {
                title: "Contract boundary",
                description: "Manual dispatch, priority reordering, and operator escalation still need dedicated dispatch mutation APIs.",
            },
        ], [inspectView, selectedTask]),
        workflowItems: workflows.length === 0
            ? [{ title: "No workflows", description: "The backend did not return any workflows." }]
            : workflows.slice(0, 8).map(mapWorkflowToSummary),
        approvalItems: approvals.length === 0
            ? [{ title: "No approvals", description: "The selected task has no dispatch-related approval records." }]
            : approvals.map((approval) => ({
                title: `${approval.decisionType ?? "approval"} · ${approval.status ?? "unknown"}`,
                description: approval.id,
            })),
        loading: (taskQuery.isLoading && tasks.length === 0) || (workflowQuery.isLoading && workflows.length === 0),
        loadError,
        selectTask(taskId) {
            setSelectedId(taskId);
        },
    };
}
