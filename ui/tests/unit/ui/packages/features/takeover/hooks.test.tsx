import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClient = { patch: vi.fn() };
const mockUpdateTask = vi.fn(async () => ({ ok: true }));
const mockFetchWorkflowRunSteps = vi.fn(async () => [
  { id: "step-1", title: "Collect inputs", status: "completed", executor: "agent-1", startedAt: "2026-05-06T00:00:00.000Z", completedAt: "2026-05-06T00:01:00.000Z" },
]);
const taskData = [
  {
    id: "task-1",
    title: "Critical release",
    status: "blocked",
    domainId: "platform",
    currentStep: "workflow-run-1",
    owner: "primary-sre",
  },
] as const;

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mockClient,
  useTasksQuery: () => ({ data: taskData }),
}));

vi.mock("@aa/shared-api-client", () => ({
  updateTask: (...args: unknown[]) => mockUpdateTask(...args),
  fetchWorkflowRunSteps: (...args: unknown[]) => mockFetchWorkflowRunSteps(...args),
}));

import { useTakeoverVm } from "../../../../../../packages/features/takeover/src/hooks";

describe("useTakeoverVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("captures and persists takeover snapshots when ownership is claimed", async () => {
    const { result } = renderHook(() => useTakeoverVm());

    await act(async () => {
      await result.current.claimOwnership("task-1", "platform-sre");
    });

    expect(mockUpdateTask).toHaveBeenCalledWith(mockClient, "task-1", { owner: "platform-sre", status: "running" });
    expect(mockFetchWorkflowRunSteps).toHaveBeenCalledWith(mockClient, "workflow-run-1");
    expect(result.current.currentSnapshot?.taskId).toBe("task-1");
    expect(result.current.currentSnapshot?.steps).toHaveLength(1);
    expect(result.current.ownershipHistory[0]?.action).toBe("claim");

    const persisted = JSON.parse(localStorage.getItem("aa-takeover-snapshots") ?? "[]");
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.taskId).toBe("task-1");
  });

  it("records transfer history and can restore a previous snapshot", async () => {
    const { result } = renderHook(() => useTakeoverVm());

    await act(async () => {
      await result.current.claimOwnership("task-1", "platform-sre");
      await result.current.transferOwnership("task-1", "backup-sre", "handoff");
    });

    expect(mockUpdateTask).toHaveBeenCalledWith(mockClient, "task-1", {
      owner: "backup-sre",
      status: "running",
      currentStep: "takeover-transfer:handoff",
    });
    expect(result.current.ownershipHistory[0]?.action).toBe("transfer:handoff");

    const initialSnapshot = JSON.parse(localStorage.getItem("aa-takeover-snapshots") ?? "[]")[1];
    await act(async () => {
      result.current.restoreFromSnapshot(initialSnapshot);
    });

    await waitFor(() => {
      expect(result.current.currentSnapshot?.taskId).toBe("task-1");
    });
  });
});
