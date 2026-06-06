// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockClient: { get: vi.fn() },
  mockUseTasksQuery: vi.fn(),
}));

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mocks.mockClient,
  useTasksQuery: mocks.mockUseTasksQuery,
}));

import { useInspectVm } from "../../../../../../packages/features/inspect/src/hooks";

describe("useInspectVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUseTasksQuery.mockReturnValue({
      data: [
        {
          id: "task-1",
          title: "Inspect real coding task",
          status: "completed",
          domainId: "coding",
          currentStep: "step-1",
          executionMode: "real_model",
          modelCallStatus: "succeeded",
          modelProvider: "minimax",
          modelName: "minimax-m2.7",
          outputSummary: "completed output",
        },
      ],
      isLoading: false,
      error: null,
    });
    mocks.mockClient.get.mockResolvedValue({
      workflowState: {
        status: "completed",
      },
      execution: {
        traceId: null,
        status: null,
      },
      recentEvents: [
        {
          id: "evt-1",
          eventType: "workflow:step_started",
          createdAt: "2026-06-05T00:01:00.000Z",
          traceId: "real-task:task-1",
        },
      ],
      approvals: [],
      dispatchDecisions: [],
      runtimeRecovery: {
        candidates: [],
      },
    });
  });

  it("falls back to recent event trace ids for completed real-model tasks", async () => {
    const { result } = renderHook(() => useInspectVm());

    await waitFor(() => {
      expect(result.current.selectedId).toBe("task-1");
      expect(mocks.mockClient.get).toHaveBeenCalledWith("/v1/tasks/task-1/inspect");
      expect(result.current.detailRows).toContainEqual({ key: "Execution Trace", value: "real-task:task-1" });
    });

    expect(result.current.detailRows).toContainEqual({ key: "Execution Trace", value: "real-task:task-1" });
    expect(result.current.detailRows).toContainEqual({ key: "Execution Mode", value: "real_model" });
    expect(result.current.detailRows).toContainEqual({ key: "Execution Status", value: "succeeded" });
    expect(result.current.eventItems[0]).toEqual({
      title: "workflow:step_started",
      description: "2026-06-05T00:01:00.000Z",
    });
  });

  it("prioritizes failed and running tasks ahead of completed history", async () => {
    mocks.mockUseTasksQuery.mockReturnValue({
      data: [
        {
          id: "task-completed",
          title: "Completed task",
          status: "completed",
          domainId: "platform",
          currentStep: "step-1",
          outputSummary: "completed output",
        },
        {
          id: "task-running",
          title: "Running task",
          status: "running",
          domainId: "platform",
          currentStep: "step-0",
          outputSummary: "running output",
        },
        {
          id: "task-failed",
          title: "Failed task",
          status: "failed",
          domainId: "platform",
          currentStep: "step-0",
          outputSummary: "failed output",
        },
      ],
      isLoading: false,
      error: null,
    });
    mocks.mockClient.get.mockResolvedValue({
      workflowState: { status: "failed" },
      execution: { traceId: "real-task:task-failed", status: "failed" },
      recentEvents: [],
      approvals: [],
      dispatchDecisions: [],
      runtimeRecovery: { candidates: [] },
    });

    const { result } = renderHook(() => useInspectVm());

    await waitFor(() => {
      expect(result.current.selectedId).toBe("task-failed");
    });

    expect(result.current.listItems.map((item) => item.id)).toEqual([
      "task-failed",
      "task-running",
      "task-completed",
    ]);
    expect(mocks.mockClient.get).toHaveBeenCalledWith("/v1/tasks/task-failed/inspect");
  });
});
