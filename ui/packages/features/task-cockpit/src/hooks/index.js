import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWorkflowRunSteps, updateTask } from "@aa/shared-api-client";
import { useRestClient, useTasksQuery } from "@aa/shared-state";
function sanitizeInput(value, fallback) {
    const normalized = (value ?? fallback).replace(/[^a-z0-9-]/gi, "");
    return normalized.length > 0 ? normalized : fallback;
}
function areTasksEquivalent(left, right) {
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
            && candidate.timelineDepth === task.timelineDepth;
    });
}
export function mapTasksToVm(tasks) {
    return tasks.map((task) => ({
        id: task.id,
        title: task.title,
        subtitle: `${task.status} · ${task.domainId}`,
    }));
}
export function useTaskCockpitVm() {
    const client = useRestClient();
    const taskQuery = useTasksQuery({ refetchInterval: 5000 });
    const tasks = taskQuery.data ?? [];
    const [selectedId, setSelectedId] = useState(null);
    const [drillDownSteps, setDrillDownSteps] = useState([]);
    const [selectedStepId, setSelectedStepId] = useState(null);
    const [timelineItems, setTimelineItems] = useState([]);
    const [pendingOperations, setPendingOperations] = useState(0);
    const [loadingEvidence] = useState(false);
    const [expandedEventId, setExpandedEventId] = useState(null);
    const [optimisticTasks, setOptimisticTasks] = useState(null);
    useEffect(() => {
        if (optimisticTasks == null || taskQuery.data == null) {
            return;
        }
        if (areTasksEquivalent(optimisticTasks, taskQuery.data)) {
            setOptimisticTasks(null);
        }
    }, [optimisticTasks, taskQuery.data]);
    const visibleTasks = optimisticTasks ?? tasks;
    const selectedTask = visibleTasks.find((task) => task.id === selectedId) ?? null;
    const evidenceChain = useMemo(() => {
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
                    description: entry,
                };
            }
            return {
                id: entry.id ?? `${selectedTask.id}-evidence-${index + 1}`,
                type: entry.type ?? "reference",
                description: entry.description ?? entry.uri ?? `evidence:${index + 1}`,
            };
        });
    }, [selectedTask]);
    const timelineEvents = useMemo(() => timelineItems.map((item, index) => ({ id: `timeline-${index + 1}`, title: item.title, description: item.description })), [timelineItems]);
    const stepOutputs = useMemo(() => drillDownSteps
        .filter((step) => selectedStepId == null || step.id === selectedStepId)
        .map((step) => `${step.title} ${step.status} · ${step.executor ?? "unknown"}`), [drillDownSteps, selectedStepId]);
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
        setTimelineItems((current) => [{ title, description }, ...current]);
        setPendingOperations((current) => current + 1);
        try {
            await updateTask(client, selectedTask.id, body);
        }
        catch (error) {
            rollback?.();
            setTimelineItems((current) => current.filter((item, index) => index !== 0));
            throw error;
        }
        finally {
            setPendingOperations((current) => Math.max(0, current - 1));
        }
    }, [client, selectedTask, updateSelected]);
    const fetchTaskDrillDown = useCallback(async (taskId) => {
        const steps = await fetchWorkflowRunSteps(client, taskId);
        setDrillDownSteps(steps);
        setSelectedStepId(steps[0]?.id ?? null);
    }, [client]);
    const selectTask = useCallback((id) => {
        setSelectedId(id);
        void fetchTaskDrillDown(id).catch(() => {
            setDrillDownSteps([]);
            setSelectedStepId(null);
        });
    }, [fetchTaskDrillDown]);
    return {
        tasks: visibleTasks,
        listItems: mapTasksToVm(visibleTasks),
        selectedId,
        selectedTask,
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
            await runTaskMutation({ owner: sanitizedOperator, status: "running" }, `Take Over · ${selectedTask?.title ?? "task"}`, `${sanitizedOperator} claimed the task and resumed ownership.`);
        },
        async pauseTask() {
            await runTaskMutation({ status: "paused", currentStep: "paused_by_operator" }, `Paused · ${selectedTask?.title ?? "task"}`, "Paused by operator.");
        },
        async cancelTask() {
            await runTaskMutation({ status: "cancelled", currentStep: "cancelled_by_operator" }, `Cancelled · ${selectedTask?.title ?? "task"}`, "Cancelled by operator.");
        },
        async retryTask() {
            await runTaskMutation({ status: "queued", currentStep: "retry_requested" }, `Retry · ${selectedTask?.title ?? "task"}`, "Retry requested.");
        },
        async resumeTask(mode) {
            const currentStep = mode === "supervised" ? "supervised-resume" : "resume";
            await runTaskMutation({ status: "running", currentStep }, `Resume · ${selectedTask?.title ?? "task"}`, `${mode} resume requested.`);
        },
        async escalateTask(target = "domain-admin") {
            const sanitizedTarget = sanitizeInput(target, "domain-admin");
            await runTaskMutation({ status: "blocked", currentStep: `escalated:${sanitizedTarget}` }, `Escalated · ${selectedTask?.title ?? "task"}`, `Escalated to ${sanitizedTarget}.`);
        },
        fetchTaskDrillDown,
    };
}
