// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockClient: { get: vi.fn() },
  mockUseTasksQuery: vi.fn(),
}));

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mocks.mockClient,
  useTasksQuery: mocks.mockUseTasksQuery,
}));

import { useWorkflowDebuggerVm } from "../../../../../../packages/features/workflow-debugger/src/hooks";

describe("useWorkflowDebuggerVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
