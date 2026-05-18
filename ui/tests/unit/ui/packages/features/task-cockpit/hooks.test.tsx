import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockClient: { patch: vi.fn(), get: vi.fn() },
  mockUpdateTask: vi.fn(async () => ({ ok: true })),
  mockFetchWorkflowRunSteps: vi.fn(async () => [
    { id: "step-1", title: "Collect inputs", status: "completed", executor: "agent-1", startedAt: "2026-05-04T00:00:00Z", completedAt: "2026-05-04T00:01:00Z" },
  ]),
  mockUseTasksQuery: vi.fn(),
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
  useRestClient: () => mocks.mockClient,
  useTasksQuery: mocks.mockUseTasksQuery,
}));

vi.mock("@aa/shared-api-client", () => ({
  updateTask: mocks.mockUpdateTask,
  fetchWorkflowRunSteps: mocks.mockFetchWorkflowRunSteps,
}));

import { useTaskCockpitVm } from "../../../../../../packages/features/task-cockpit/src/hooks";

describe("useTaskCockpitVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUseTasksQuery.mockReturnValue({
      data: taskData,
    });
  });

  it("keeps selection empty until the operator explicitly picks a task and enables polling", () => {
    const { result } = renderHook(() => useTaskCockpitVm());

    expect(mocks.mockUseTasksQuery).toHaveBeenCalledWith(undefined, { refetchInterval: 5000 });
    expect(result.current.selectedId).toBeNull();
    expect(result.current.selectedTask).toBeNull();
  });

  it("calls backend mutations for claim, pause, cancel, retry, resume, and escalate", async () => {
    const { result } = renderHook(() => useTaskCockpitVm());

    act(() => {
      result.current.selectTask("task-1");
    });

    await act(async () => {
      await result.current.claimTask("platform-sre");
      await result.current.pauseTask();
      await result.current.cancelTask();
      await result.current.retryTask();
      await result.current.resumeTask("supervised");
      await result.current.escalateTask("domain-admin");
    });

    expect(mocks.mockUpdateTask).toHaveBeenCalledWith(mocks.mockClient, "task-1", { owner: "platform-sre", status: "running" });
    expect(mocks.mockUpdateTask).toHaveBeenCalledWith(mocks.mockClient, "task-1", { status: "paused", currentStep: "paused_by_operator" });
    expect(mocks.mockUpdateTask).toHaveBeenCalledWith(mocks.mockClient, "task-1", { status: "cancelled", currentStep: "cancelled_by_operator" });
    expect(mocks.mockUpdateTask).toHaveBeenCalledWith(mocks.mockClient, "task-1", { status: "queued", currentStep: "retry_requested" });
    expect(mocks.mockUpdateTask).toHaveBeenCalledWith(mocks.mockClient, "task-1", { status: "running", currentStep: "supervised-resume" });
    expect(mocks.mockUpdateTask).toHaveBeenCalledWith(mocks.mockClient, "task-1", { status: "blocked", currentStep: "escalated:domain-admin" });

    await waitFor(() => {
      expect(result.current.timelineItems[0]?.title).toContain("Escalated");
    });
  });

  it("rolls back optimistic task mutations when the backend call fails", async () => {
    mocks.mockUpdateTask.mockRejectedValueOnce(new Error("network-failed"));
    const { result } = renderHook(() => useTaskCockpitVm());

    act(() => {
      result.current.selectTask("task-1");
    });

    await act(async () => {
      await expect(result.current.claimTask("platform-sre")).rejects.toThrow(/network-failed/);
    });

    expect(result.current.selectedTask?.owner).toBe("growth-ops");
    expect(result.current.selectedTask?.status).toBe("blocked");
    expect(result.current.timelineItems).toHaveLength(0);
  });
});
