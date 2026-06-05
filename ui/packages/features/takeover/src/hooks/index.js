import { useCallback, useEffect, useMemo, useState } from "react";
import { annotateAdminTakeoverSession, fetchAdminTakeoverConsole, openAdminTakeoverSession, resumeAdminTakeoverSession, } from "@aa/shared-api-client";
import { translateMessage } from "@aa/shared-i18n";
import { useRestClient, useTasksQuery, useWsClient } from "@aa/shared-state";
function mapTakeoverTaskStatus(status) {
    switch (status) {
        case "awaiting_decision":
        case "paused":
            return "paused";
        case "in_progress":
            return "running";
        case "done":
            return "completed";
        default:
            return status;
    }
}
function selectTakeoverCandidate(tasks) {
    const active = tasks.find((task) => task.status === "running" || task.status === "paused" || task.status === "blocked");
    if (active != null) {
        return active;
    }
    const queued = tasks.find((task) => task.status === "queued");
    if (queued != null) {
        return queued;
    }
    return null;
}
function parseOwnerFromInputJson(inputJson) {
    if (inputJson == null || inputJson.trim().length === 0) {
        return null;
    }
    try {
        const parsed = JSON.parse(inputJson);
        return typeof parsed.owner === "string" && parsed.owner.trim().length > 0
            ? parsed.owner.trim()
            : null;
    }
    catch {
        return null;
    }
}
function mapWorkflowOutputStatus(status) {
    switch (status) {
        case "failed":
            return "failed";
        case "running":
            return "running";
        case "succeeded":
        case "partial_success":
        case "skipped":
        case "completed":
            return "completed";
        default:
            return "pending";
    }
}
function resolveSnapshotOwner(consoleSnapshot) {
    const openSession = [...consoleSnapshot.inspect.takeoverSessions]
        .reverse()
        .find((session) => session.status === "open");
    if (openSession != null) {
        return openSession.operatorId;
    }
    return (parseOwnerFromInputJson(consoleSnapshot.inspect.task.inputJson)
        ?? consoleSnapshot.executionOwner.workerId
        ?? consoleSnapshot.executionOwner.agentId
        ?? "automatic-execution");
}
function buildSnapshotSteps(consoleSnapshot, owner) {
    const stepOutputs = consoleSnapshot.inspect.stepOutputs ?? [];
    if (stepOutputs.length === 0) {
        const taskStatus = mapTakeoverTaskStatus(consoleSnapshot.inspect.task.status);
        return [
            {
                id: consoleSnapshot.inspect.execution?.id ?? consoleSnapshot.inspect.task.id,
                title: consoleSnapshot.inspect.execution?.id ?? "task",
                status: taskStatus === "failed"
                    ? "failed"
                    : taskStatus === "completed"
                        ? "completed"
                        : taskStatus === "paused"
                            ? "pending"
                            : "running",
                executor: owner,
            },
        ];
    }
    return stepOutputs.map((step, index) => ({
        id: step.id ?? step.stepId ?? `${consoleSnapshot.inspect.task.id}-step-${index + 1}`,
        title: step.summary ?? step.stepId ?? `step-${index + 1}`,
        status: mapWorkflowOutputStatus(step.status),
        executor: step.roleId ?? owner,
        ...(step.producedAt == null ? {} : { completedAt: step.producedAt }),
    }));
}
function buildSnapshot(consoleSnapshot) {
    const owner = resolveSnapshotOwner(consoleSnapshot);
    return {
        taskId: consoleSnapshot.scope.taskId,
        owner,
        status: mapTakeoverTaskStatus(consoleSnapshot.inspect.task.status),
        steps: buildSnapshotSteps(consoleSnapshot, owner),
        capturedAt: consoleSnapshot.generatedAt,
    };
}
function buildOwnershipHistory(consoleSnapshot) {
    return [...consoleSnapshot.inspect.operatorActions]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((entry) => {
        let action = entry.actionType;
        if (entry.actionPayloadJson != null) {
            try {
                const payload = JSON.parse(entry.actionPayloadJson);
                if (payload.mode === "resume_automatic_execution") {
                    action = "resume";
                }
                else if (typeof payload.note === "string" && payload.note.trim().length > 0) {
                    action = `annotate:${payload.note.trim()}`;
                }
            }
            catch {
                // Ignore malformed payloads and surface the raw action type.
            }
        }
        return {
            taskId: entry.taskId,
            owner: entry.operatorId,
            action,
            recordedAt: entry.createdAt,
        };
    });
}
function resolveOpenSessionId(consoleSnapshot) {
    if (consoleSnapshot == null) {
        return null;
    }
    return [...consoleSnapshot.inspect.takeoverSessions]
        .reverse()
        .find((session) => session.status === "open")
        ?.id ?? null;
}
export function useTakeoverVm() {
    const client = useRestClient();
    const wsClient = useWsClient();
    const tasks = useTasksQuery().data ?? [];
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mutating, setMutating] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [consoleSnapshot, setConsoleSnapshot] = useState(null);
    const candidateTask = useMemo(() => selectTakeoverCandidate(tasks), [tasks]);
    const loadTaskConsole = useCallback(async (taskId) => {
        const nextSnapshot = await fetchAdminTakeoverConsole(client, taskId);
        setConsoleSnapshot(nextSnapshot);
        setSelectedTaskId(taskId);
        return nextSnapshot;
    }, [client]);
    useEffect(() => {
        if (selectedTaskId != null || candidateTask == null) {
            if (selectedTaskId == null && candidateTask == null) {
                setConsoleSnapshot(null);
                setLoading(false);
            }
            return;
        }
        let mounted = true;
        setLoading(true);
        void loadTaskConsole(candidateTask.id).then(() => {
            if (mounted) {
                setErrorMessage(null);
                setLoading(false);
            }
        }).catch(() => {
            if (mounted) {
                setConsoleSnapshot(null);
                setLoading(false);
                setErrorMessage("takeover.load_failed");
            }
        });
        return () => {
            mounted = false;
        };
    }, [candidateTask, loadTaskConsole, selectedTaskId]);
    useEffect(() => {
        return wsClient.subscribe("tasks", (event) => {
            if (!event.type.startsWith("task.") || selectedTaskId == null) {
                return;
            }
            const payload = event.payload;
            if (payload.taskId !== selectedTaskId) {
                return;
            }
            void loadTaskConsole(selectedTaskId).catch(() => {
                setErrorMessage("takeover.refresh_failed");
            });
        });
    }, [loadTaskConsole, selectedTaskId, wsClient]);
    const claimOwnership = useCallback(async (taskId, _owner) => {
        setMutating(true);
        setErrorMessage(null);
        try {
            await openAdminTakeoverSession(client, taskId, {
                reasonCode: "operator.manual_takeover",
            });
            await loadTaskConsole(taskId);
        }
        catch {
            setErrorMessage("takeover.claim_failed");
            throw new Error("takeover.claim_failed");
        }
        finally {
            setMutating(false);
            setLoading(false);
        }
    }, [client, loadTaskConsole]);
    const takeoverCurrentTask = useCallback(async (owner) => {
        const nextCandidate = selectTakeoverCandidate(tasks);
        if (nextCandidate == null) {
            throw new Error("takeover.no_active_task_available");
        }
        await claimOwnership(nextCandidate.id, owner);
    }, [claimOwnership, tasks]);
    const annotateCurrentSnapshot = useCallback(async (note, _owner) => {
        const openSessionId = resolveOpenSessionId(consoleSnapshot);
        if (openSessionId == null) {
            throw new Error("takeover.no_open_session");
        }
        setMutating(true);
        setErrorMessage(null);
        try {
            await annotateAdminTakeoverSession(client, openSessionId, {
                reasonCode: "operator.takeover_annotation",
                note,
            });
            await loadTaskConsole(consoleSnapshot.scope.taskId);
        }
        catch {
            setErrorMessage("takeover.annotation_failed");
            throw new Error("takeover.annotation_failed");
        }
        finally {
            setMutating(false);
        }
    }, [client, consoleSnapshot, loadTaskConsole]);
    const resumeAutomaticExecution = useCallback(async (_owner) => {
        const openSessionId = resolveOpenSessionId(consoleSnapshot);
        if (openSessionId == null) {
            throw new Error("takeover.no_open_session");
        }
        setMutating(true);
        setErrorMessage(null);
        try {
            await resumeAdminTakeoverSession(client, openSessionId, {
                reasonCode: "operator.resume_automatic_execution",
            });
            await loadTaskConsole(consoleSnapshot.scope.taskId);
        }
        catch {
            setErrorMessage("takeover.resume_failed");
            throw new Error("takeover.resume_failed");
        }
        finally {
            setMutating(false);
        }
    }, [client, consoleSnapshot, loadTaskConsole]);
    const refresh = useCallback(async () => {
        const taskId = selectedTaskId ?? candidateTask?.id;
        if (taskId == null) {
            setConsoleSnapshot(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setErrorMessage(null);
        try {
            await loadTaskConsole(taskId);
        }
        catch {
            setErrorMessage("takeover.refresh_failed");
            throw new Error("takeover.refresh_failed");
        }
        finally {
            setLoading(false);
        }
    }, [candidateTask, loadTaskConsole, selectedTaskId]);
    const currentSnapshot = useMemo(() => (consoleSnapshot == null ? null : buildSnapshot(consoleSnapshot)), [consoleSnapshot]);
    const ownershipHistory = useMemo(() => (consoleSnapshot == null ? [] : buildOwnershipHistory(consoleSnapshot)), [consoleSnapshot]);
    const openSessionId = resolveOpenSessionId(consoleSnapshot);
    return useMemo(() => ({
        items: [
            { title: translateMessage("ui.takeover.item.manual.title"), description: translateMessage("ui.takeover.item.manual.description") },
            { title: translateMessage("ui.takeover.item.override.title"), description: translateMessage("ui.takeover.item.override.description") },
            { title: translateMessage("ui.takeover.item.resume.title"), description: translateMessage("ui.takeover.item.resume.description") },
        ],
        loading,
        mutating,
        errorMessage,
        currentSnapshot,
        ownershipHistory,
        canTakeover: candidateTask != null && !mutating,
        canAnnotate: openSessionId != null && !mutating,
        canResume: openSessionId != null && !mutating,
        claimOwnership,
        takeoverCurrentTask,
        annotateCurrentSnapshot,
        resumeAutomaticExecution,
        refresh,
    }), [
        annotateCurrentSnapshot,
        candidateTask,
        claimOwnership,
        currentSnapshot,
        errorMessage,
        loading,
        mutating,
        openSessionId,
        ownershipHistory,
        refresh,
        resumeAutomaticExecution,
        takeoverCurrentTask,
    ]);
}
