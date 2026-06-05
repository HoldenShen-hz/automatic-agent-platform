import { useCallback, useEffect, useMemo, useState } from "react";
import { updateTask } from "@aa/shared-api-client";
import { translateMessage } from "@aa/shared-i18n";
import { useRestClient, useTasksQuery, useWsClient } from "@aa/shared-state";
const STORAGE_KEY = "aa-takeover-snapshots";
const HISTORY_STORAGE_KEY = "aa-takeover-history";
const MAX_SNAPSHOTS = 20;
const MAX_HISTORY_ENTRIES = 32;
function readSnapshots() {
    if (typeof window === "undefined") {
        return [];
    }
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
        return Array.isArray(parsed)
            ? parsed.filter(isTakeoverSnapshot).slice(0, MAX_SNAPSHOTS)
            : [];
    }
    catch {
        return [];
    }
}
function writeSnapshots(snapshots) {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
    }
    catch {
        // Ignore storage write failures and preserve the in-memory snapshot state.
    }
}
function readHistory() {
    if (typeof window === "undefined") {
        return [];
    }
    try {
        const parsed = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]");
        return Array.isArray(parsed)
            ? parsed.filter(isTakeoverHistoryEntry).slice(0, MAX_HISTORY_ENTRIES)
            : [];
    }
    catch {
        return [];
    }
}
function writeHistory(entries) {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
    }
    catch {
        // Ignore storage write failures and preserve the in-memory history state.
    }
}
function commitSnapshots(updater) {
    const nextSnapshots = updater(readSnapshots()).slice(0, MAX_SNAPSHOTS);
    writeSnapshots(nextSnapshots);
    return nextSnapshots;
}
function selectTakeoverCandidate(tasks) {
    const active = tasks.find((task) => task.status === "running" || task.status === "blocked");
    if (active != null) {
        return active;
    }
    const queued = tasks.find((task) => task.status === "queued");
    if (queued != null) {
        return queued;
    }
    return null;
}
function buildFallbackSnapshotSteps(task, owner) {
    return [
        {
            id: task.currentStep,
            title: task.currentStep,
            status: task.status === "failed" ? "failed" : task.status === "completed" ? "completed" : "running",
            executor: owner,
        },
    ];
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
async function resolveSnapshotSteps(client, task, owner) {
    if (task == null) {
        return [];
    }
    try {
        const workflow = await client.get(`/v1/workflows/${encodeURIComponent(task.id)}`);
        const stepOutputs = workflow.inspect?.stepOutputs ?? [];
        if (stepOutputs.length === 0) {
            return buildFallbackSnapshotSteps(task, owner);
        }
        return stepOutputs.map((step, index) => ({
            id: step.id ?? step.stepId ?? `${task.id}-step-${index + 1}`,
            title: step.summary ?? step.stepId ?? `step-${index + 1}`,
            status: mapWorkflowOutputStatus(step.status),
            executor: step.roleId ?? owner,
            ...(step.producedAt == null ? {} : { completedAt: step.producedAt }),
        }));
    }
    catch {
        return buildFallbackSnapshotSteps(task, owner);
    }
}
export function useTakeoverVm() {
    const client = useRestClient();
    const wsClient = useWsClient();
    const tasks = useTasksQuery().data ?? [];
    const [currentSnapshot, setCurrentSnapshot] = useState(() => readSnapshots()[0] ?? null);
    const [ownershipHistory, setOwnershipHistory] = useState(() => readHistory());
    const appendHistory = useCallback((entry) => {
        setOwnershipHistory((entries) => {
            const nextEntries = [entry, ...entries].slice(0, MAX_HISTORY_ENTRIES);
            writeHistory(nextEntries);
            return nextEntries;
        });
    }, []);
    const claimOwnership = useCallback(async (taskId, owner) => {
        const task = tasks.find((candidate) => candidate.id === taskId);
        await updateTask(client, taskId, { owner, status: "running" });
        const steps = await resolveSnapshotSteps(client, task, owner);
        const snapshot = {
            taskId,
            owner,
            status: "running",
            steps,
            capturedAt: new Date().toISOString(),
        };
        commitSnapshots((current) => [snapshot, ...current]);
        setCurrentSnapshot(snapshot);
        appendHistory({ taskId, owner, action: "claim", recordedAt: snapshot.capturedAt });
    }, [appendHistory, client, tasks]);
    const transferOwnership = useCallback(async (taskId, owner, reason) => {
        await updateTask(client, taskId, {
            owner,
            status: "running",
        });
        const baseSnapshot = currentSnapshot ?? readSnapshots()[0] ?? null;
        if (baseSnapshot != null) {
            const transferSnapshot = {
                ...baseSnapshot,
                owner,
                capturedAt: new Date().toISOString(),
            };
            commitSnapshots((current) => [transferSnapshot, ...current]);
            setCurrentSnapshot(transferSnapshot);
        }
        appendHistory({ taskId, owner, action: `transfer:${reason}`, recordedAt: new Date().toISOString() });
    }, [appendHistory, client, currentSnapshot]);
    const takeoverCurrentTask = useCallback(async (owner) => {
        const candidate = selectTakeoverCandidate(tasks);
        if (candidate == null) {
            throw new Error("takeover.no_active_task_available");
        }
        await claimOwnership(candidate.id, owner);
    }, [claimOwnership, tasks]);
    const annotateCurrentSnapshot = useCallback((note, owner) => {
        if (currentSnapshot == null) {
            throw new Error("takeover.no_snapshot_available");
        }
        appendHistory({ taskId: currentSnapshot.taskId, owner, action: `annotate:${note}`, recordedAt: new Date().toISOString() });
    }, [appendHistory, currentSnapshot]);
    const resumeAutomaticExecution = useCallback(async (owner) => {
        if (currentSnapshot == null) {
            throw new Error("takeover.no_snapshot_available");
        }
        await updateTask(client, currentSnapshot.taskId, { owner, status: "running" });
        appendHistory({ taskId: currentSnapshot.taskId, owner, action: "resume", recordedAt: new Date().toISOString() });
    }, [appendHistory, client, currentSnapshot]);
    useEffect(() => {
        return wsClient.subscribe("tasks", (event) => {
            if (!event.type.startsWith("task.")) {
                return;
            }
            const payload = event.payload;
            if (payload.taskId == null) {
                return;
            }
            setCurrentSnapshot((snapshot) => {
                if (snapshot == null || snapshot.taskId !== payload.taskId) {
                    return snapshot;
                }
                const nextSnapshot = {
                    ...snapshot,
                    owner: payload.owner ?? snapshot.owner,
                    status: payload.status ?? snapshot.status,
                    steps: payload.steps ?? snapshot.steps,
                    capturedAt: snapshot.capturedAt,
                };
                if (nextSnapshot.owner === snapshot.owner
                    && nextSnapshot.status === snapshot.status
                    && nextSnapshot.steps === snapshot.steps) {
                    return snapshot;
                }
                const updatedSnapshot = {
                    ...nextSnapshot,
                    capturedAt: new Date().toISOString(),
                };
                commitSnapshots((current) => [updatedSnapshot, ...current]);
                return updatedSnapshot;
            });
        });
    }, [wsClient]);
    return useMemo(() => ({
        items: [
            { title: translateMessage("ui.takeover.item.manual.title"), description: translateMessage("ui.takeover.item.manual.description") },
            { title: translateMessage("ui.takeover.item.override.title"), description: translateMessage("ui.takeover.item.override.description") },
            { title: translateMessage("ui.takeover.item.resume.title"), description: translateMessage("ui.takeover.item.resume.description") },
        ],
        currentSnapshot,
        ownershipHistory,
        canTakeover: selectTakeoverCandidate(tasks) != null,
        canAnnotate: currentSnapshot != null,
        canResume: currentSnapshot != null,
        claimOwnership,
        transferOwnership,
        restoreFromSnapshot: setCurrentSnapshot,
        takeoverCurrentTask,
        annotateCurrentSnapshot,
        resumeAutomaticExecution,
    }), [annotateCurrentSnapshot, claimOwnership, currentSnapshot, ownershipHistory, resumeAutomaticExecution, takeoverCurrentTask, tasks, transferOwnership]);
}
function isTakeoverSnapshot(value) {
    if (value == null || typeof value !== "object") {
        return false;
    }
    const snapshot = value;
    return typeof snapshot.taskId === "string"
        && typeof snapshot.owner === "string"
        && typeof snapshot.status === "string"
        && Array.isArray(snapshot.steps)
        && typeof snapshot.capturedAt === "string";
}
function isTakeoverHistoryEntry(value) {
    if (value == null || typeof value !== "object") {
        return false;
    }
    const entry = value;
    return typeof entry.taskId === "string"
        && typeof entry.owner === "string"
        && typeof entry.action === "string"
        && typeof entry.recordedAt === "string";
}
