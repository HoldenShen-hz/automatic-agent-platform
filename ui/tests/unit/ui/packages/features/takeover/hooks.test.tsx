// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockClient: { patch: vi.fn(), get: vi.fn() },
  mockSubscribe: vi.fn(() => () => undefined),
  mockUpdateTask: vi.fn(async () => ({ ok: true })),
}));
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
  useRestClient: () => mocks.mockClient,
  useWsClient: () => ({ subscribe: mocks.mockSubscribe }),
  useTasksQuery: () => ({ data: taskData }),
}));

vi.mock("@aa/shared-api-client", () => ({
  updateTask: mocks.mockUpdateTask,
}));

import { useTakeoverVm } from "../../../../../../packages/features/takeover/src/hooks";

describe("useTakeoverVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.mockClient.get.mockResolvedValue({
      inspect: {
        stepOutputs: [
          {
            id: "step-1",
            stepId: "collect-inputs",
            summary: "Collect inputs",
            status: "succeeded",
            roleId: "agent-1",
            producedAt: "2026-05-06T00:01:00.000Z",
          },
        ],
      },
    });
  });

  it("captures and persists takeover snapshots when ownership is claimed", async () => {
    const { result } = renderHook(() => useTakeoverVm());

    await act(async () => {
      await result.current.claimOwnership("task-1", "platform-sre");
    });

    expect(mocks.mockUpdateTask).toHaveBeenCalledWith(mocks.mockClient, "task-1", { owner: "platform-sre", status: "running" });
    expect(mocks.mockClient.get).toHaveBeenCalledWith("/v1/workflows/task-1");
    expect(result.current.currentSnapshot?.taskId).toBe("task-1");
    expect(result.current.currentSnapshot?.steps).toHaveLength(1);
    expect(result.current.ownershipHistory[0]?.action).toBe("claim");

    const persisted = JSON.parse(localStorage.getItem("aa-takeover-snapshots") ?? "[]");
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.taskId).toBe("task-1");
  });

  it("falls back to the current task step when workflow-run steps are unavailable", async () => {
    mocks.mockClient.get.mockRejectedValueOnce(new Error("Route not found."));
    const { result } = renderHook(() => useTakeoverVm());

    await act(async () => {
      await result.current.claimOwnership("task-1", "platform-sre");
    });

    expect(result.current.currentSnapshot?.steps).toEqual([
      {
        id: "workflow-run-1",
        title: "workflow-run-1",
        status: "running",
        executor: "platform-sre",
      },
    ]);
  });

  it("records transfer history and can restore a previous snapshot", async () => {
    const { result } = renderHook(() => useTakeoverVm());

    await act(async () => {
      await result.current.claimOwnership("task-1", "platform-sre");
      await result.current.transferOwnership("task-1", "backup-sre", "handoff");
    });

    expect(mocks.mockUpdateTask).toHaveBeenCalledWith(mocks.mockClient, "task-1", {
      owner: "backup-sre",
      status: "running",
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

  it("persists local annotations across remounts", async () => {
    const { result, unmount } = renderHook(() => useTakeoverVm());

    await act(async () => {
      await result.current.claimOwnership("task-1", "platform-sre");
    });

    act(() => {
      result.current.annotateCurrentSnapshot("manual-note", "platform-sre");
    });

    expect(result.current.ownershipHistory[0]?.action).toBe("annotate:manual-note");

    unmount();

    const remounted = renderHook(() => useTakeoverVm());
    expect(remounted.result.current.ownershipHistory[0]?.action).toBe("annotate:manual-note");
  });
});
