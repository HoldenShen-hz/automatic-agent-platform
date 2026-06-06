// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockClient: { get: vi.fn() },
  mockUseTasksQuery: vi.fn(),
  mockCopyTextToClipboard: vi.fn(),
}));

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mocks.mockClient,
  useTasksQuery: mocks.mockUseTasksQuery,
}));

vi.mock("@aa/shared-platform", () => ({
  copyTextToClipboard: mocks.mockCopyTextToClipboard,
}));

import { useWorkflowDebuggerVm } from "../../../../../../packages/features/workflow-debugger/src/hooks";
import { prioritizeDebuggerTasks } from "../../../../../../packages/features/workflow-debugger/src/hooks";

describe("prioritizeDebuggerTasks", () => {
  it("prioritizes failed and running tasks ahead of completed history for default debugger focus", () => {
    const tasks = prioritizeDebuggerTasks([
      { id: "task-done", title: "done", status: "done", domainId: "platform", currentStep: "step-0" },
      { id: "task-running", title: "running", status: "running", domainId: "platform", currentStep: "step-0" },
      { id: "task-failed", title: "failed", status: "failed", domainId: "platform", currentStep: "step-0" },
      { id: "task-queued", title: "queued", status: "queued", domainId: "platform", currentStep: "step-0" },
    ] as Array<{
      id: string;
      title: string;
      status: string;
      domainId: string;
      currentStep: string;
    }>);

    expect(tasks.map((task) => task.id)).toEqual([
      "task-failed",
      "task-running",
      "task-queued",
      "task-done",
    ]);
  });
});

describe("useWorkflowDebuggerVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCopyTextToClipboard.mockResolvedValue(undefined);
    mocks.mockUseTasksQuery.mockReturnValue({
      data: [
        {
          id: "task-1",
          title: "Replay failed coding task",
          status: "failed",
          domainId: "coding",
          currentStep: "real_model",
          executionMode: "real_model",
          modelProvider: "minimax",
          modelName: "minimax-m2.7",
          outputSummary: "real task execution failed",
        },
      ],
      isLoading: false,
      error: null,
    });
    mocks.mockClient.get.mockResolvedValue({
      inspect: {
        stepOutputs: [
          {
            id: "step-output-1",
            stepId: "collect-inputs",
            roleId: "agent-1",
            status: "succeeded",
            summary: "Collect inputs",
            producedAt: "2026-06-05T00:00:00.000Z",
          },
          {
            id: "step-output-2",
            stepId: "real_model",
            roleId: "minimax",
            status: "failed",
            summary: "MiniMax overload",
            producedAt: "2026-06-05T00:02:00.000Z",
          },
        ],
      },
      timeline: {
        entries: [
          {
            id: "timeline-1",
            title: "workflow:step_started",
            summary: "Real model execution started",
            occurredAt: "2026-06-05T00:01:00.000Z",
          },
        ],
      },
    });
  });

  it("loads live task debug data and exports a real snapshot", async () => {
    const { result } = renderHook(() => useWorkflowDebuggerVm());

    await waitFor(() => {
      expect(result.current.selectedId).toBe("task-1");
      expect(mocks.mockClient.get).toHaveBeenCalledWith("/v1/tasks/task-1");
      expect(result.current.timelineItems[0]).toEqual({
        title: "workflow:step_started",
        description: "2026-06-05T00:01:00.000Z · Real model execution started",
      });
    });

    await act(async () => {
      await result.current.focusFailure();
    });

    expect(result.current.activePanel).toBe("failure");
    expect(result.current.failureItems[0]).toEqual({
      title: "MiniMax overload",
      description: "minimax · 2026-06-05T00:02:00.000Z",
    });

    await act(async () => {
      await result.current.exportDebugSnapshot();
    });

    expect(result.current.activePanel).toBe("export");
    expect(result.current.exportSnapshot).toContain("\"task\"");
    expect(result.current.activityItems[0]?.title).toBe("Debug snapshot exported");
  });

  it("surfaces clipboard failures without reporting export success", async () => {
    mocks.mockCopyTextToClipboard.mockRejectedValue(new Error("Unable to copy to clipboard in the current browser context."));

    const { result } = renderHook(() => useWorkflowDebuggerVm());

    await waitFor(() => {
      expect(result.current.selectedId).toBe("task-1");
    });

    await act(async () => {
      await result.current.exportDebugSnapshot();
    });

    expect(result.current.activePanel).toBe("export");
    expect(result.current.activityItems[0]).toEqual({
      title: "Debug snapshot export failed",
      description: "Unable to copy to clipboard in the current browser context.",
    });
  });

  it("defaults to the highest-priority failed task when newer completed tasks exist", async () => {
    mocks.mockUseTasksQuery.mockReturnValue({
      data: [
        {
          id: "task-completed",
          title: "Completed task",
          status: "done",
          domainId: "platform",
          currentStep: "real_model",
          executionMode: "real_model",
          modelProvider: "minimax",
          modelName: "minimax-m2.7",
          outputSummary: "completed",
        },
        {
          id: "task-failed-priority",
          title: "Failed task",
          status: "failed",
          domainId: "platform",
          currentStep: "real_model",
          executionMode: "real_model",
          modelProvider: "minimax",
          modelName: "minimax-m2.7",
          outputSummary: "failed",
        },
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useWorkflowDebuggerVm());

    await waitFor(() => {
      expect(result.current.selectedId).toBe("task-failed-priority");
      expect(mocks.mockClient.get).toHaveBeenCalledWith("/v1/tasks/task-failed-priority");
    });
  });
});
