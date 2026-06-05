import { useCallback, useEffect, useMemo, useState } from "react";
import { createTask, updateTask } from "@aa/shared-api-client";
import { useRestClient, useTasksQuery } from "@aa/shared-state";
function sanitizeInput(value, fallback) {
    const normalized = (value ?? fallback).replace(/[^a-z0-9-]/gi, "");
    return normalized.length > 0 ? normalized : fallback;
}
function sanitizeTaskTitle(value) {
    return value.replace(/\s+/g, " ").trim().slice(0, 160);
}
function createLocalTaskId(title) {
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/giu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
    return `task-${slug.length > 0 ? slug : "new"}-${Date.now().toString(36)}`;
}
function readCreatedTaskId(response) {
    const taskId = response?.snapshot?.task?.id;
    return typeof taskId === "string" && taskId.length > 0 ? taskId : null;
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
        completedAt: step.producedAt,
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
            startedAt: execution?.startedAt,
            completedAt: execution?.finishedAt ?? undefined,
        },
    ];
}
function buildEvidenceItemsFromCockpit(taskId, cockpit) {
    return (cockpit.inspect?.artifacts ?? []).map((artifact, index) => ({
        id: artifact.artifactId,
        type: artifact.kind ?? "artifact",
        description: artifact.fileName ?? artifact.stepId ?? `${taskId}-artifact-${index + 1}`,
    }));
}
function buildTimelineItemsFromCockpit(cockpit) {
    return (cockpit.timeline?.entries ?? []).map((entry) => ({
        title: entry.title,
        description: entry.summary,
    }));
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
    const [serverTimelineItems, setServerTimelineItems] = useState([]);
    const [pendingOperations, setPendingOperations] = useState(0);
    const [loadingEvidence] = useState(false);
    const [expandedEventId, setExpandedEventId] = useState(null);
    const [optimisticTasks, setOptimisticTasks] = useState(null);
    const [serverEvidenceChain, setServerEvidenceChain] = useState([]);
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
                    description: entry,
                };
            }
            return {
                id: entry.id ?? `${selectedTask.id}-evidence-${index + 1}`,
                type: entry.type ?? "reference",
                description: entry.description ?? entry.uri ?? `evidence:${index + 1}`,
            };
        });
    }, [selectedTask, serverEvidenceChain]);
    const timelineEvents = useMemo(() => [...timelineItems, ...serverTimelineItems].map((item, index) => ({ id: `timeline-${index + 1}`, title: item.title, description: item.description })), [serverTimelineItems, timelineItems]);
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
        const cockpit = await client.get(`/v1/tasks/${encodeURIComponent(taskId)}`);
        const task = visibleTasks.find((candidate) => candidate.id === taskId) ?? null;
        const steps = buildDrillDownSteps(task, cockpit);
        setServerEvidenceChain(buildEvidenceItemsFromCockpit(taskId, cockpit));
        setServerTimelineItems(buildTimelineItemsFromCockpit(cockpit));
        setDrillDownSteps(steps);
        setSelectedStepId(steps[0]?.id ?? null);
    }, [client, visibleTasks]);
    const selectTask = useCallback((id) => {
        setSelectedId(id);
        void fetchTaskDrillDown(id).catch(() => {
            setDrillDownSteps([]);
            setSelectedStepId(null);
            setServerEvidenceChain([]);
            setServerTimelineItems([]);
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
        selectedTask?.status,
    ]);
    const createTaskFromPrompt = useCallback(async (input) => {
        const title = sanitizeTaskTitle(input.title);
        if (title.length === 0) {
            throw new Error("task.title_required");
        }
        const domainId = sanitizeInput(input.domainId, "platform");
        const owner = input.owner == null || input.owner.trim().length === 0
            ? undefined
            : sanitizeInput(input.owner, "platform-sre");
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
            ...(owner == null ? {} : { owner }),
        };
        const nextTasks = [nextTask, ...visibleTasks];
        setOptimisticTasks(nextTasks);
        setSelectedId(nextTask.id);
        setDrillDownSteps([]);
        setSelectedStepId(null);
        setServerEvidenceChain([]);
        setServerTimelineItems([]);
        setTimelineItems((current) => [
            { title: `Created · ${title}`, description: `Queued in ${domainId} from operator input.` },
            ...current,
        ]);
        setPendingOperations((current) => current + 1);
        try {
            const created = await createTask(client, {
                title,
                divisionId: domainId,
                ...(owner == null ? {} : { owner }),
            });
            const createdTaskId = readCreatedTaskId(created);
            if (createdTaskId != null) {
                setOptimisticTasks((current) => current?.map((task) => (task.id === nextTask.id ? { ...task, id: createdTaskId } : task)) ?? current);
                setSelectedId(createdTaskId);
            }
        }
        finally {
            setPendingOperations((current) => Math.max(0, current - 1));
        }
    }, [client, visibleTasks]);
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
        createTaskFromPrompt,
    };
}
