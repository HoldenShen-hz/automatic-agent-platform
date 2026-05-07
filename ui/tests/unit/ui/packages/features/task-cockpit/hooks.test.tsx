import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClient = { patch: vi.fn(), get: vi.fn() };
const mockUpdateTask = vi.fn(async () => ({ ok: true }));
const mockFetchWorkflowRunSteps = vi.fn(async () => [
  { id: "step-1", title: "Collect inputs", status: "completed", executor: "agent-1", startedAt: "2026-05-04T00:00:00Z", completedAt: "2026-05-04T00:01:00Z" },
]);
const mockUseTasksQuery = vi.fn(() => ({
  data: taskData,
}));
const taskData = [
  {
    id: "task-1",
    title: "Spring campaign",
    status: "blocked",
    domainId: "marketing",
    currentStep: "workflow-run-1",
    owner: "growth-ops",
    evidenceCount: 2,
    timelineDepth: 5,
  },
] as const;

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mockClient,
  useTasksQuery: (...args: unknown[]) => mockUseTasksQuery(...args),
}));

vi.mock("@aa/shared-api-client", () => ({
  updateTask: (...args: unknown[]) => mockUpdateTask(...args),
  fetchWorkflowRunSteps: (...args: unknown[]) => mockFetchWorkflowRunSteps(...args),
}));

import { useTaskCockpitVm } from "../../../../../../packages/features/task-cockpit/src/hooks";

describe("useTaskCockpitVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps selection empty until the operator explicitly picks a task and enables polling", () => {
    const { result } = renderHook(() => useTaskCockpitVm());

    expect(mockUseTasksQuery).toHaveBeenCalledWith(undefined, { refetchInterval: 5000 });
    expect(result.current.selectedId).toBeNull();
    expect(result.current.selectedTask).toBeNull();
  });

  it("calls backend mutations for claim, resume, and escalate", async () => {
    const { result } = renderHook(() => useTaskCockpitVm());

    act(() => {
      result.current.selectTask("task-1");
    });

    await act(async () => {
      await result.current.claimTask("platform-sre");
      await result.current.resumeTask("supervised");
      await result.current.escalateTask("domain-admin");
    });

    expect(mockUpdateTask).toHaveBeenCalledWith(mockClient, "task-1", { owner: "platform-sre", status: "running" });
    expect(mockUpdateTask).toHaveBeenCalledWith(mockClient, "task-1", { status: "running", currentStep: "supervised-resume" });
    expect(mockUpdateTask).toHaveBeenCalledWith(mockClient, "task-1", { status: "blocked", currentStep: "escalated:domain-admin" });

    await waitFor(() => {
      expect(result.current.timelineItems[0]?.title).toContain("Escalated");
    });
  });

  it("rolls back optimistic task mutations when the backend call fails", async () => {
    mockUpdateTask.mockRejectedValueOnce(new Error("network-failed"));
    const { result } = renderHook(() => useTaskCockpitVm());

    act(() => {
      result.current.selectTask("task-1");
    });

    let error: Error | null = null;
    await act(async () => {
      try {
        await result.current.claimTask("platform-sre");
      } catch (err) {
        error = err as Error;
      }
    });

    expect(error?.message).toMatch(/network-failed/);
    expect(result.current.selectedTask?.owner).toBe("growth-ops");
    expect(result.current.selectedTask?.status).toBe("blocked");
    expect(result.current.timelineItems).toHaveLength(0);
  });
});
