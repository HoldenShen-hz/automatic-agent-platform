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

import { useTraceExplorerVm } from "../../../../../../packages/features/trace-explorer/src/hooks";

describe("useTraceExplorerVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUseTasksQuery.mockReturnValue({
      data: [
        {
          id: "task-1",
          title: "Trace real coding task",
          status: "completed",
          domainId: "coding",
          currentStep: "step-1",
          executionMode: "real_model",
          modelProvider: "minimax",
          modelName: "minimax-m2.7",
          outputSummary: "completed output",
        },
      ],
      isLoading: false,
      error: null,
    });
    mocks.mockClient.get.mockResolvedValue({
      inspect: {
        execution: {
          traceId: null,
        },
        artifacts: [
          { id: "artifact-1", kind: "report_markdown", uri: "/tmp/report.md" },
        ],
      },
      timeline: {
        entries: [
          {
            id: "timeline-1",
            title: "workflow:step_started",
            summary: "Real model execution started",
            occurredAt: "2026-06-05T00:01:00.000Z",
            traceId: "real-task:task-1",
          },
          {
            id: "timeline-2",
            title: "workflow:step_completed",
            summary: "Real model execution completed",
            occurredAt: "2026-06-05T00:02:00.000Z",
            traceId: "real-task:task-1",
          },
        ],
      },
    });
  });

  it("falls back to timeline trace ids for completed real-model tasks", async () => {
    const { result } = renderHook(() => useTraceExplorerVm());

    await waitFor(() => {
      expect(result.current.selectedId).toBe("task-1");
      expect(mocks.mockClient.get).toHaveBeenCalledWith("/v1/tasks/task-1");
      expect(result.current.detailRows).toContainEqual({ key: "Trace ID", value: "real-task:task-1" });
    });

    expect(result.current.detailRows).toContainEqual({ key: "Trace ID", value: "real-task:task-1" });
    expect(result.current.detailRows).toContainEqual({ key: "Model", value: "minimax / minimax-m2.7" });
    expect(result.current.summaryItems[1]).toEqual({
      title: "Latest trace",
      description: "workflow:step_completed @ 2026-06-05T00:02:00.000Z.",
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
      inspect: {
        execution: {
          traceId: "real-task:task-failed",
        },
        artifacts: [],
      },
      timeline: {
        entries: [],
      },
    });

    const { result } = renderHook(() => useTraceExplorerVm());

    await waitFor(() => {
      expect(result.current.selectedId).toBe("task-failed");
    });

    expect(result.current.listItems.map((item) => item.id)).toEqual([
      "task-failed",
      "task-running",
      "task-completed",
    ]);
    expect(mocks.mockClient.get).toHaveBeenCalledWith("/v1/tasks/task-failed");
  });
});
