import { useMemo, useState } from "react";
import { updateTask, fetchWorkflowRunSteps } from "@aa/shared-api-client";
import { useRestClient, useTasksQuery } from "@aa/shared-state";

const STORAGE_KEY = "aa-takeover-snapshots";
const MAX_SNAPSHOTS = 20;

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
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as TakeoverSnapshot[];
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

export function useTakeoverVm(): TakeoverVm {
  const client = useRestClient();
  const tasks = useTasksQuery().data ?? [];
  const [currentSnapshot, setCurrentSnapshot] = useState<TakeoverSnapshot | null>(() => readSnapshots()[0] ?? null);
  const [ownershipHistory, setOwnershipHistory] = useState<readonly TakeoverHistoryEntry[]>([]);

  async function claimOwnership(taskId: string, owner: string): Promise<void> {
    const task = tasks.find((candidate) => candidate.id === taskId);
    await updateTask(client, taskId, { owner, status: "running" });
    const steps = task?.currentStep == null ? [] : await fetchWorkflowRunSteps(client, task.currentStep);
    const snapshot: TakeoverSnapshot = {
      taskId,
      owner,
      status: "running",
      steps,
      capturedAt: new Date().toISOString(),
    };
    const nextSnapshots = [snapshot, ...readSnapshots()].slice(0, MAX_SNAPSHOTS);
    writeSnapshots(nextSnapshots);
    setCurrentSnapshot(snapshot);
    setOwnershipHistory((entries) => [{ taskId, owner, action: "claim", recordedAt: snapshot.capturedAt }, ...entries]);
  }

  async function transferOwnership(taskId: string, owner: string, reason: string): Promise<void> {
    await updateTask(client, taskId, {
      owner,
      status: "running",
      currentStep: `takeover-transfer:${reason}`,
    });
    const baseSnapshot = currentSnapshot ?? readSnapshots()[0] ?? null;
    if (baseSnapshot != null) {
      const transferSnapshot: TakeoverSnapshot = {
        ...baseSnapshot,
        owner,
        capturedAt: new Date().toISOString(),
      };
      writeSnapshots([transferSnapshot, ...readSnapshots()]);
      setCurrentSnapshot(transferSnapshot);
    }
    setOwnershipHistory((entries) => [{ taskId, owner, action: `transfer:${reason}`, recordedAt: new Date().toISOString() }, ...entries]);
  }

  async function takeoverCurrentTask(owner: string): Promise<void> {
    const firstTask = tasks[0];
    if (firstTask == null) {
      return;
    }
    await claimOwnership(firstTask.id, owner);
  }

  function annotateCurrentSnapshot(note: string, owner: string): void {
    if (currentSnapshot == null) {
      return;
    }
    setOwnershipHistory((entries) => [{ taskId: currentSnapshot.taskId, owner, action: `annotate:${note}`, recordedAt: new Date().toISOString() }, ...entries]);
  }

  async function resumeAutomaticExecution(owner: string): Promise<void> {
    if (currentSnapshot == null) {
      return;
    }
    await updateTask(client, currentSnapshot.taskId, { owner, status: "running" });
    setOwnershipHistory((entries) => [{ taskId: currentSnapshot.taskId, owner, action: "resume", recordedAt: new Date().toISOString() }, ...entries]);
  }

  return useMemo(() => ({
    items: [
      { title: "Manual Takeover", description: "切换执行到人工接管模式并记录理由。" },
      { title: "Override Actions", description: "执行人工覆盖、取消或重排。" },
      { title: "Resume Control", description: "完成接管后选择恢复模式继续执行。" },
    ],
    currentSnapshot,
    ownershipHistory,
    claimOwnership,
    transferOwnership,
    restoreFromSnapshot: setCurrentSnapshot,
    takeoverCurrentTask,
    annotateCurrentSnapshot,
    resumeAutomaticExecution,
  }), [annotateCurrentSnapshot, claimOwnership, currentSnapshot, ownershipHistory, resumeAutomaticExecution, takeoverCurrentTask, transferOwnership]);
}
