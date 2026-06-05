import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRestClient, useTasksQuery, useWorkflowsQuery } from "@aa/shared-state";
import { cancelWorkflow, pauseWorkflow as pauseWorkflowApi, recoverWorkflow as recoverWorkflowApi, releaseWorkflow as releaseWorkflowApi, resumeWorkflow as resumeWorkflowApi, } from "@aa/shared-api-client";
function mapWorkflowStepStatus(status) {
    switch (status) {
        case "failed":
            return "failed";
        case "succeeded":
        case "partial_success":
        case "skipped":
        case "completed":
            return "completed";
        case "running":
            return "running";
        default:
            return "pending";
    }
}
function mapWorkflowEvidenceType(kind) {
    if (kind == null) {
        return "artifact";
    }
    if (kind.includes("report")) {
        return "report";
    }
    if (kind.includes("trace")) {
        return "trace";
    }
    if (kind.includes("log")) {
        return "log";
    }
    return "artifact";
}
function mapWorkflowDetailStatus(status) {
    switch (status) {
        case "completed":
            return "completed";
        case "failed":
            return "failed";
        case "cancelled":
            return "cancelled";
        case "paused":
        case "blocked":
        case "awaiting_decision":
            return "paused";
        case "draft":
            return "draft";
        default:
            return "running";
    }
}
function enrichWorkflowSummary(workflow, tasksById) {
    const linkedTask = tasksById.get(workflow.id);
    return {
        ...workflow,
        title: linkedTask?.title ?? workflow.title,
        owner: linkedTask?.domainId ?? workflow.owner,
    };
}
function mapWorkflowDetail(workflowId, cockpit, fallbackWorkflow, fallbackTask) {
    const task = cockpit.inspect?.task;
    const workflowState = cockpit.inspect?.workflowState;
    const stepOutputs = cockpit.inspect?.stepOutputs ?? [];
    const artifacts = cockpit.inspect?.artifacts ?? [];
    const approvals = cockpit.inspect?.approvals ?? [];
    const currentStepIndex = workflowState?.currentStepIndex ?? cockpit.summary?.currentStepIndex ?? null;
    const currentStage = workflowState?.resumableFromStep
        ?? fallbackWorkflow?.currentStage
        ?? (typeof currentStepIndex === "number" ? `step-${currentStepIndex}` : "intake");
    return {
        id: task?.id ?? cockpit.summary?.taskId ?? workflowId,
        title: task?.title ?? fallbackTask?.title ?? fallbackWorkflow?.title ?? cockpit.summary?.workflowId ?? workflowId,
        status: mapWorkflowDetailStatus(workflowState?.status ?? cockpit.summary?.workflowStatus ?? task?.status)
            ?? fallbackWorkflow?.status
            ?? "running",
        currentStage,
        owner: task?.divisionId ?? fallbackTask?.domainId ?? fallbackWorkflow?.owner ?? cockpit.summary?.divisionId ?? "platform",
        steps: stepOutputs.map((step, index) => ({
            id: step.id ?? step.stepId ?? `${workflowId}-step-${index + 1}`,
            title: step.summary ?? step.stepId ?? `step-${index + 1}`,
            phase: "Execute",
            status: mapWorkflowStepStatus(step.status),
            completedAt: step.producedAt,
        })),
        approvalNodes: approvals.map((approval, index) => ({
            nodeId: approval.approvalId ?? `${workflowId}-approval-${index + 1}`,
            title: approval.title ?? approval.approvalId ?? `approval-${index + 1}`,
            status: approval.status === "approved" || approval.status === "rejected" || approval.status === "delegated"
                ? approval.status
                : "pending",
            ...(approval.approverId == null ? {} : { assignee: approval.approverId }),
        })),
        evidenceRefs: artifacts
            .filter((artifact) => typeof artifact?.artifactId === "string")
            .map((artifact, index) => ({
            refId: artifact.artifactId,
            type: mapWorkflowEvidenceType(artifact.kind),
            uri: artifact.storagePath ?? `artifact://${artifact.artifactId}`,
            description: artifact.fileName ?? artifact.kind ?? `artifact-${index + 1}`,
        })),
    };
}
export function mapWorkflowsToVm(workflows) {
    return {
        workflows,
        listItems: workflows.map((workflow) => ({
            id: workflow.id,
            title: workflow.title,
            subtitle: `${workflow.status} · ${workflow.currentStage}`,
        })),
    };
}
function buildWorkflowControls(workflow) {
    if (workflow == null) {
        return {
            cancelEnabled: false,
            pauseEnabled: false,
            resumeEnabled: false,
            recoverEnabled: false,
            releaseEnabled: false,
        };
    }
    switch (workflow.status) {
        case "running":
            return {
                cancelEnabled: true,
                pauseEnabled: true,
                resumeEnabled: false,
                recoverEnabled: false,
                releaseEnabled: true,
            };
        case "paused":
            return {
                cancelEnabled: true,
                pauseEnabled: false,
                resumeEnabled: true,
                recoverEnabled: false,
                releaseEnabled: false,
            };
        case "failed":
            return {
                cancelEnabled: false,
                pauseEnabled: false,
                resumeEnabled: false,
                recoverEnabled: true,
                releaseEnabled: false,
            };
        default:
            return {
                cancelEnabled: false,
                pauseEnabled: false,
                resumeEnabled: false,
                recoverEnabled: false,
                releaseEnabled: false,
            };
    }
}
export function useWorkflowCockpitVm() {
    const client = useRestClient();
    const queryClient = useQueryClient();
    const workflows = useWorkflowsQuery().data ?? [];
    const tasks = useTasksQuery().data ?? [];
    const [selectedId, setSelectedId] = useState(null);
    const [activityItems, setActivityItems] = useState([]);
    const [pendingOperations, setPendingOperations] = useState(0);
    const [serverWorkflow, setServerWorkflow] = useState(null);
    const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
    const resolvedWorkflows = useMemo(() => workflows.map((workflow) => enrichWorkflowSummary(workflow, tasksById)), [tasksById, workflows]);
    useEffect(() => {
        setSelectedId((current) => {
            if (current != null && resolvedWorkflows.some((workflow) => workflow.id === current)) {
                return current;
            }
            return null;
        });
    }, [resolvedWorkflows]);
    useEffect(() => {
        if (serverWorkflow != null && !resolvedWorkflows.some((workflow) => workflow.id === serverWorkflow.id)) {
            setServerWorkflow(null);
        }
    }, [resolvedWorkflows, serverWorkflow]);
    const baseVm = useMemo(() => mapWorkflowsToVm(resolvedWorkflows), [resolvedWorkflows]);
    const selectedSummaryWorkflow = resolvedWorkflows.find((workflow) => workflow.id === selectedId) ?? null;
    const selectedWorkflow = serverWorkflow?.id === selectedId
        ? serverWorkflow
        : selectedSummaryWorkflow;
    const controls = useMemo(() => buildWorkflowControls(selectedWorkflow), [selectedWorkflow]);
    const fetchWorkflowDetail = useCallback(async (workflowId) => {
        const cockpit = await client.get(`/v1/workflows/${encodeURIComponent(workflowId)}`);
        const fallbackWorkflow = resolvedWorkflows.find((workflow) => workflow.id === workflowId) ?? null;
        const nextWorkflow = mapWorkflowDetail(workflowId, cockpit, fallbackWorkflow, tasksById.get(workflowId));
        setServerWorkflow(nextWorkflow);
    }, [client, resolvedWorkflows, tasksById]);
    const runAction = useCallback(async (action, title, description) => {
        setPendingOperations((current) => current + 1);
        try {
            await action();
            setActivityItems((current) => [{ title, description }, ...current]);
            await queryClient.invalidateQueries({ queryKey: ["workflows"] });
        }
        finally {
            setPendingOperations((current) => Math.max(0, current - 1));
        }
    }, [queryClient]);
    const selectWorkflow = useCallback((workflowId) => {
        setSelectedId(workflowId);
        void fetchWorkflowDetail(workflowId).catch(() => {
            setServerWorkflow(null);
        });
    }, [fetchWorkflowDetail]);
    useEffect(() => {
        if (selectedId == null) {
            return;
        }
        void fetchWorkflowDetail(selectedId).catch(() => {
            setServerWorkflow(null);
        });
    }, [fetchWorkflowDetail, selectedId, selectedSummaryWorkflow?.currentStage, selectedSummaryWorkflow?.status]);
    const cancelSelectedWorkflow = useCallback(async () => {
        if (selectedWorkflow == null || !controls.cancelEnabled) {
            return;
        }
        await runAction(() => cancelWorkflow(client, selectedWorkflow.id), `Canceled · ${selectedWorkflow.title}`, "Workflow was canceled from the cockpit.");
    }, [client, controls.cancelEnabled, runAction, selectedWorkflow]);
    const pauseSelectedWorkflow = useCallback(async () => {
        if (selectedWorkflow == null || !controls.pauseEnabled) {
            return;
        }
        await runAction(() => pauseWorkflowApi(client, selectedWorkflow.id), `Paused · ${selectedWorkflow.title}`, "Workflow entered HITL waiting state.");
    }, [client, controls.pauseEnabled, runAction, selectedWorkflow]);
    const resumeSelectedWorkflow = useCallback(async () => {
        if (selectedWorkflow == null || !controls.resumeEnabled) {
            return;
        }
        await runAction(() => resumeWorkflowApi(client, selectedWorkflow.id), `Resumed · ${selectedWorkflow.title}`, "Workflow resumed execution from the selected checkpoint.");
    }, [client, controls.resumeEnabled, runAction, selectedWorkflow]);
    const recoverSelectedWorkflow = useCallback(async () => {
        if (selectedWorkflow == null || !controls.recoverEnabled) {
            return;
        }
        await runAction(() => recoverWorkflowApi(client, selectedWorkflow.id), `Recovered · ${selectedWorkflow.title}`, "Recovery controller rebuilt state and replayed the workflow.");
    }, [client, controls.recoverEnabled, runAction, selectedWorkflow]);
    const releaseSelectedWorkflow = useCallback(async () => {
        if (selectedWorkflow == null || !controls.releaseEnabled) {
            return;
        }
        await runAction(() => releaseWorkflowApi(client, selectedWorkflow.id), `Released · ${selectedWorkflow.title}`, "Workflow completed release checks and closed successfully.");
    }, [client, controls.releaseEnabled, runAction, selectedWorkflow]);
    return {
        ...baseVm,
        selectedId,
        selectedWorkflow,
        controls,
        activityItems,
        pendingOperations,
        selectWorkflow,
        cancelWorkflow: cancelSelectedWorkflow,
        pauseWorkflow: pauseSelectedWorkflow,
        resumeWorkflow: resumeSelectedWorkflow,
        recoverWorkflow: recoverSelectedWorkflow,
        releaseWorkflow: releaseSelectedWorkflow,
    };
}
