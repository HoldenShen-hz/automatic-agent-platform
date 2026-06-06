// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockCancelWorkflow: vi.fn(async () => ({ ok: true })),
  mockClient: { patch: vi.fn(), get: vi.fn() },
  mockCreateTask: vi.fn(async () => ({ snapshot: { task: { id: "task-created-1" } } })),
  mockFetchTasks: vi.fn(async () => taskData),
  mockPauseWorkflow: vi.fn(async () => ({ ok: true })),
  mockRecoverWorkflow: vi.fn(async () => ({ ok: true })),
  mockResumeWorkflow: vi.fn(async () => ({ ok: true })),
  mockUpdateTask: vi.fn(async () => ({ ok: true })),
  mockUseTasksQuery: vi.fn(),
}));
let taskData: Array<{
  id: string;
  title: string;
  status: string;
  domainId: string;
  currentStep: string;
  owner: string;
  evidenceCount: number;
  timelineDepth: number;
  executionMode?: "mock_dev" | "real_model" | "manual" | "external";
  modelCallStatus?: "not_called" | "pending" | "running" | "succeeded" | "failed";
  modelProvider?: string;
  modelName?: string;
  outputSummary?: string | null;
  outputUri?: string | null;
}> = [
  {
    id: "task-1",
    title: "Historical completed task",
    status: "completed",
    domainId: "platform",
    currentStep: "workflow-run-1",
    owner: "platform-sre",
    evidenceCount: 2,
    timelineDepth: 5,
    executionMode: "real_model",
    modelCallStatus: "succeeded",
    modelProvider: "minimax",
    modelName: "minimax-m2.7",
    outputSummary: "Completed output",
    outputUri: "/tmp/completed.md",
  },
  {
    id: "task-2",
    title: "Actionable blocked task",
    status: "blocked",
    domainId: "marketing",
    currentStep: "workflow-run-2",
    owner: "growth-ops",
    evidenceCount: 1,
    timelineDepth: 3,
    executionMode: "mock_dev",
    modelCallStatus: "not_called",
    modelProvider: "minimax",
    modelName: "minimax-m2.7",
    outputSummary: null,
    outputUri: null,
  },
];

vi.mock("@aa/shared-state", () => ({
  taskQueryKeys: { tasks: ["tasks"] },
  useRestClient: () => mocks.mockClient,
  useTasksQuery: mocks.mockUseTasksQuery,
}));

vi.mock("@aa/shared-api-client", () => ({
  cancelWorkflow: mocks.mockCancelWorkflow,
  createTask: mocks.mockCreateTask,
  fetchTasks: mocks.mockFetchTasks,
  pauseWorkflow: mocks.mockPauseWorkflow,
  recoverWorkflow: mocks.mockRecoverWorkflow,
  resumeWorkflow: mocks.mockResumeWorkflow,
  updateTask: mocks.mockUpdateTask,
}));

import { useTaskCockpitVm } from "../../../../../../packages/features/task-cockpit/src/hooks";

function renderTaskCockpitHook() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return renderHook(() => useTaskCockpitVm(), {
    wrapper({ children }: { readonly children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    },
  });
}

describe("useTaskCockpitVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    taskData = [
      {
        id: "task-1",
        title: "Historical completed task",
        status: "completed",
        domainId: "platform",
        currentStep: "workflow-run-1",
        owner: "platform-sre",
        evidenceCount: 2,
        timelineDepth: 5,
        executionMode: "real_model",
        modelCallStatus: "succeeded",
        modelProvider: "minimax",
        modelName: "minimax-m2.7",
        outputSummary: "Completed output",
        outputUri: "/tmp/completed.md",
      },
      {
        id: "task-2",
        title: "Actionable blocked task",
        status: "blocked",
        domainId: "marketing",
        currentStep: "workflow-run-2",
        owner: "growth-ops",
        evidenceCount: 1,
        timelineDepth: 3,
        executionMode: "mock_dev",
        modelCallStatus: "not_called",
        modelProvider: "minimax",
        modelName: "minimax-m2.7",
        outputSummary: null,
        outputUri: null,
      },
    ];
    mocks.mockUseTasksQuery.mockImplementation(() => ({
      data: taskData,
    }));
    mocks.mockFetchTasks.mockImplementation(async () => taskData);
    mocks.mockClient.get.mockImplementation(async (path: string) => {
      if (path === "/v1/tasks") {
        return { tasks: taskData };
      }
      return {
        inspect: {
          workflowState: { currentStepIndex: 1, status: "running", resumableFromStep: "review" },
          execution: { agentId: "agent-1", startedAt: "2026-05-04T00:00:00Z", finishedAt: null },
          stepOutputs: [
            {
              id: "step-output-1",
              nodeRunId: "node-1",
              stepId: "collect-inputs",
              roleId: "agent-1",
              status: "succeeded",
              summary: "Collect inputs",
              producedAt: "2026-05-04T00:01:00Z",
            },
          ],
          artifacts: [
            {
              artifactId: "artifact-1",
              kind: "report",
              fileName: "analysis.md",
              stepId: "collect-inputs",
            },
          ],
        },
        timeline: {
          entries: [
            {
              id: "timeline-1",
              title: "dispatch:dispatched",
              summary: "Dispatch routed to worker-1",
              occurredAt: "2026-05-04T00:01:30Z",
            },
          ],
        },
      };
    });
  });

  it("auto-selects the highest-priority actionable task instead of leaving the detail pane empty", async () => {
    const { result } = renderTaskCockpitHook();

    expect(mocks.mockUseTasksQuery).toHaveBeenCalledWith({ refetchInterval: 5000 });
    await waitFor(() => {
      expect(result.current.selectedId).toBe("task-2");
      expect(result.current.selectedTask?.title).toBe("Actionable blocked task");
      expect(result.current.listItems.map((item) => item.id)).toEqual(["task-2", "task-1"]);
    });
  });

  it("calls backend mutations for claim, pause, cancel, retry, resume, and escalate", async () => {
    const { result } = renderTaskCockpitHook();

    act(() => {
      result.current.selectTask("task-2");
    });

    await act(async () => {
      await result.current.claimTask("platform-sre");
      await result.current.pauseTask();
      await result.current.cancelTask();
      await result.current.retryTask();
      await result.current.resumeTask("supervised");
      await result.current.escalateTask("domain-admin");
    });

    expect(mocks.mockUpdateTask).toHaveBeenCalledWith(mocks.mockClient, "task-2", { owner: "platform-sre", status: "running" });
    expect(mocks.mockPauseWorkflow).toHaveBeenCalledWith(mocks.mockClient, "task-2");
    expect(mocks.mockCancelWorkflow).toHaveBeenCalledWith(mocks.mockClient, "task-2");
    expect(mocks.mockRecoverWorkflow).toHaveBeenCalledWith(mocks.mockClient, "task-2");
    expect(mocks.mockResumeWorkflow).toHaveBeenCalledWith(mocks.mockClient, "task-2", "supervised");
    expect(mocks.mockUpdateTask).toHaveBeenCalledWith(mocks.mockClient, "task-2", { status: "blocked" });

    await waitFor(() => {
      expect(result.current.timelineItems[0]?.title).toContain("Escalated");
    });
  });

  it("loads drill-down, evidence, and timeline data from the task cockpit endpoint", async () => {
    const { result } = renderTaskCockpitHook();

    act(() => {
      result.current.selectTask("task-2");
    });

    await waitFor(() => {
      expect(mocks.mockClient.get).toHaveBeenCalledWith("/v1/tasks/task-2");
      expect(result.current.stepViewer.steps).toEqual([
        expect.objectContaining({
          id: "node-1",
          title: "Collect inputs",
          status: "completed",
          executor: "agent-1",
        }),
        expect.objectContaining({
          id: "workflow-run-2",
          title: "review",
          status: "running",
          executor: "agent-1",
        }),
      ]);
      expect(result.current.evidenceViewer.evidenceChain).toEqual([
        {
          id: "artifact-1",
          type: "report",
          description: "analysis.md",
        },
      ]);
      expect(result.current.timelineViewer.timelineEvents[0]).toEqual({
        id: "timeline-1",
        title: "dispatch:dispatched",
        description: "Dispatch routed to worker-1",
      });
    });
  });

  it("disables ownership and workflow controls for terminal completed tasks", async () => {
    taskData = [
      {
        ...taskData[1]!,
        status: "completed",
      },
    ];
    const { result } = renderTaskCockpitHook();

    act(() => {
      result.current.selectTask("task-2");
    });

    await waitFor(() => {
      expect(result.current.workflowControlsAvailable).toBe(false);
      expect(result.current.workflowControlReason).toMatch(/already terminal/);
    });
  });

  it("creates a task from operator input and selects it optimistically", async () => {
    taskData = [
      {
        id: "task-created-1",
        title: "Analyze platform alerts and draft a remediation plan",
        status: "queued",
        domainId: "platform-ops",
        currentStep: "intake",
        owner: "platform-sre",
        evidenceCount: 0,
        timelineDepth: 1,
        executionMode: "real_model",
        modelCallStatus: "pending",
        modelProvider: "minimax",
        modelName: "minimax-m2.7",
        outputSummary: null,
        outputUri: null,
      },
      ...taskData,
    ];
    const { result } = renderTaskCockpitHook();

    await act(async () => {
      await result.current.createTaskFromPrompt({
        title: "  Analyze platform alerts and draft a remediation plan  ",
        domainId: "platform-ops",
        owner: "platform-sre",
      });
    });

    expect(mocks.mockCreateTask).toHaveBeenCalledWith(
      mocks.mockClient,
      expect.objectContaining({
        title: "Analyze platform alerts and draft a remediation plan",
        divisionId: "platform-ops",
        owner: "platform-sre",
      }),
    );
    expect(result.current.selectedId).toBe("task-created-1");
    expect(result.current.selectedTask?.title).toBe("Analyze platform alerts and draft a remediation plan");
  });

  it("rejects empty task input before calling the backend", async () => {
    const { result } = renderTaskCockpitHook();

    await act(async () => {
      await expect(result.current.createTaskFromPrompt({ title: "   " })).rejects.toThrow(/task.title_required/);
    });

    expect(mocks.mockCreateTask).not.toHaveBeenCalled();
  });

  it("does not fabricate evidence records from the evidence count alone", () => {
    const { result } = renderTaskCockpitHook();

    act(() => {
      result.current.selectTask("task-2");
    });

    expect(result.current.evidenceViewer.evidenceChain).toEqual([]);
  });

  it("rolls back optimistic task mutations when the backend call fails", async () => {
    mocks.mockUpdateTask.mockRejectedValueOnce(new Error("network-failed"));
    const { result } = renderTaskCockpitHook();

    act(() => {
      result.current.selectTask("task-2");
    });

    await act(async () => {
      await expect(result.current.claimTask("platform-sre")).rejects.toThrow(/network-failed/);
    });

    expect(result.current.selectedTask?.owner).toBe("growth-ops");
    expect(result.current.selectedTask?.status).toBe("blocked");
    expect(result.current.timelineItems).toHaveLength(0);
  });

  it("keeps optimistic task state across polling until the server catches up", async () => {
    const { result, rerender } = renderTaskCockpitHook();

    act(() => {
      result.current.selectTask("task-2");
    });

    await act(async () => {
      await result.current.claimTask("platform-sre");
    });

    expect(result.current.selectedTask?.owner).toBe("platform-sre");
    expect(result.current.selectedTask?.status).toBe("running");

    taskData = [
      taskData[0]!,
      {
        ...taskData[1]!,
        owner: "growth-ops",
        status: "blocked",
      },
    ];
    rerender();
    expect(result.current.selectedTask?.owner).toBe("platform-sre");
    expect(result.current.selectedTask?.status).toBe("running");

    taskData = [
      taskData[0]!,
      {
        ...taskData[1]!,
        owner: "platform-sre",
        status: "running",
      },
    ];
    rerender();
    expect(result.current.selectedTask?.owner).toBe("platform-sre");
    expect(result.current.selectedTask?.status).toBe("running");
  });

  it("does not fabricate a non-persisted current step during retry", async () => {
    const { result } = renderTaskCockpitHook();

    act(() => {
      result.current.selectTask("task-2");
    });

    await act(async () => {
      await result.current.retryTask();
    });

    expect(result.current.selectedTask?.currentStep).toBe("workflow-run-2");
    expect(mocks.mockRecoverWorkflow).toHaveBeenCalledWith(mocks.mockClient, "task-2");
  });
});
