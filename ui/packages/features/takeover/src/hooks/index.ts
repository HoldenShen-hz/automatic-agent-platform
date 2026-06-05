import { useCallback, useEffect, useMemo, useState } from "react";
import { updateTask, fetchWorkflowRunSteps } from "@aa/shared-api-client";
import { translateMessage } from "@aa/shared-i18n";
import type { TaskDTO, WorkflowRunStepDTO } from "@aa/shared-types";
import { useRestClient, useTasksQuery, useWsClient } from "@aa/shared-state";

const STORAGE_KEY = "aa-takeover-snapshots";
const MAX_SNAPSHOTS = 20;
const MAX_HISTORY_ENTRIES = 32;

export interface TakeoverSnapshot {
  readonly taskId: string;
  readonly owner: string;
  readonly status: string;
  readonly steps: readonly unknown[];
  readonly capturedAt: string;
}

export interface TakeoverHistoryEntry {
  readonly taskId: string;
  readonly owner: string;
  readonly action: string;
  readonly recordedAt: string;
}

export interface TakeoverVm {
  readonly items: readonly { title: string; description: string }[];
  readonly currentSnapshot: TakeoverSnapshot | null;
  readonly ownershipHistory: readonly TakeoverHistoryEntry[];
  readonly canTakeover: boolean;
  readonly canAnnotate: boolean;
  readonly canResume: boolean;
  claimOwnership(taskId: string, owner: string): Promise<void>;
  transferOwnership(taskId: string, owner: string, reason: string): Promise<void>;
  restoreFromSnapshot(snapshot: TakeoverSnapshot): void;
  takeoverCurrentTask(owner: string): Promise<void>;
  annotateCurrentSnapshot(note: string, owner: string): void;
  resumeAutomaticExecution(owner: string): Promise<void>;
}

function readSnapshots(): TakeoverSnapshot[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter(isTakeoverSnapshot).slice(0, MAX_SNAPSHOTS)
      : [];
  } catch {
    return [];
  }
}

function writeSnapshots(snapshots: readonly TakeoverSnapshot[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // Ignore storage write failures and preserve the in-memory snapshot state.
  }
}

function commitSnapshots(updater: (current: readonly TakeoverSnapshot[]) => readonly TakeoverSnapshot[]): readonly TakeoverSnapshot[] {
  const nextSnapshots = updater(readSnapshots()).slice(0, MAX_SNAPSHOTS);
  writeSnapshots(nextSnapshots);
  return nextSnapshots;
}

function selectTakeoverCandidate(tasks: readonly TaskDTO[]): TaskDTO | null {
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

function buildFallbackSnapshotSteps(task: TaskDTO, owner: string): readonly WorkflowRunStepDTO[] {
  return [
    {
      id: task.currentStep,
      title: task.currentStep,
      status: task.status === "failed" ? "failed" : task.status === "completed" ? "completed" : "running",
      executor: owner,
    },
  ];
}

async function resolveSnapshotSteps(
  client: ReturnType<typeof useRestClient>,
  task: TaskDTO | undefined,
  owner: string,
): Promise<readonly WorkflowRunStepDTO[]> {
  if (task == null) {
    return [];
  }
  try {
    return await fetchWorkflowRunSteps(client, task.currentStep);
  } catch {
    return buildFallbackSnapshotSteps(task, owner);
  }
}

export function useTakeoverVm(): TakeoverVm {
  const client = useRestClient();
  const wsClient = useWsClient();
  const tasks = useTasksQuery().data ?? [];
  const [currentSnapshot, setCurrentSnapshot] = useState<TakeoverSnapshot | null>(() => readSnapshots()[0] ?? null);
  const [ownershipHistory, setOwnershipHistory] = useState<readonly TakeoverHistoryEntry[]>([]);

  const appendHistory = useCallback((entry: TakeoverHistoryEntry) => {
    setOwnershipHistory((entries) => [entry, ...entries].slice(0, MAX_HISTORY_ENTRIES));
  }, []);

  const claimOwnership = useCallback(async (taskId: string, owner: string): Promise<void> => {
    const task = tasks.find((candidate) => candidate.id === taskId);
    await updateTask(client, taskId, { owner, status: "running" });
    const steps = await resolveSnapshotSteps(client, task, owner);
    const snapshot: TakeoverSnapshot = {
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

  const transferOwnership = useCallback(async (taskId: string, owner: string, reason: string): Promise<void> => {
    await updateTask(client, taskId, {
      owner,
      status: "running",
    });
    const baseSnapshot = currentSnapshot ?? readSnapshots()[0] ?? null;
    if (baseSnapshot != null) {
      const transferSnapshot: TakeoverSnapshot = {
        ...baseSnapshot,
        owner,
        capturedAt: new Date().toISOString(),
      };
      commitSnapshots((current) => [transferSnapshot, ...current]);
      setCurrentSnapshot(transferSnapshot);
    }
    appendHistory({ taskId, owner, action: `transfer:${reason}`, recordedAt: new Date().toISOString() });
  }, [appendHistory, client, currentSnapshot]);

  const takeoverCurrentTask = useCallback(async (owner: string): Promise<void> => {
    const candidate = selectTakeoverCandidate(tasks);
    if (candidate == null) {
      throw new Error("takeover.no_active_task_available");
    }
    await claimOwnership(candidate.id, owner);
  }, [claimOwnership, tasks]);

  const annotateCurrentSnapshot = useCallback((note: string, owner: string): void => {
    if (currentSnapshot == null) {
      throw new Error("takeover.no_snapshot_available");
    }
    appendHistory({ taskId: currentSnapshot.taskId, owner, action: `annotate:${note}`, recordedAt: new Date().toISOString() });
  }, [appendHistory, currentSnapshot]);

  const resumeAutomaticExecution = useCallback(async (owner: string): Promise<void> => {
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
      const payload = event.payload as { taskId?: string; owner?: string; status?: string; steps?: readonly unknown[] };
      if (payload.taskId == null) {
        return;
      }
      setCurrentSnapshot((snapshot) => {
        if (snapshot == null || snapshot.taskId !== payload.taskId) {
          return snapshot;
        }
        const nextSnapshot: TakeoverSnapshot = {
          ...snapshot,
          owner: payload.owner ?? snapshot.owner,
          status: payload.status ?? snapshot.status,
          steps: payload.steps ?? snapshot.steps,
          capturedAt: snapshot.capturedAt,
        };
        if (
          nextSnapshot.owner === snapshot.owner
          && nextSnapshot.status === snapshot.status
          && nextSnapshot.steps === snapshot.steps
        ) {
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

function isTakeoverSnapshot(value: unknown): value is TakeoverSnapshot {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const snapshot = value as Record<string, unknown>;
  return typeof snapshot.taskId === "string"
    && typeof snapshot.owner === "string"
    && typeof snapshot.status === "string"
    && Array.isArray(snapshot.steps)
    && typeof snapshot.capturedAt === "string";
}
