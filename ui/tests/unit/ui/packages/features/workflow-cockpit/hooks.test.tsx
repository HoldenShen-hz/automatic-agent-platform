// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskDTO, WorkflowDTO } from "@aa/shared-types";

const mocks = vi.hoisted(() => ({
  mockClient: { post: vi.fn(), get: vi.fn() },
  mockPauseWorkflow: vi.fn(async () => ({ ok: true })),
  mockCancelWorkflow: vi.fn(async () => ({ ok: true })),
  mockResumeWorkflow: vi.fn(async () => ({ ok: true })),
  mockRecoverWorkflow: vi.fn(async () => ({ ok: true })),
  mockReleaseWorkflow: vi.fn(async () => ({ ok: true })),
  mockInvalidateQueries: vi.fn(async () => undefined),
  mockUseTasksQuery: vi.fn(),
}));
let workflowData: readonly WorkflowDTO[] = [
  {
    id: "workflow-1",
    title: "real_task_execution",
    status: "running",
    currentStage: "execute",
    owner: "platform",
    domainId: "platform",
    steps: [],
  },
];
let taskData: readonly TaskDTO[] = [
  {
    id: "workflow-1",
    title: "Campaign Launch",
    status: "running",
    domainId: "growth-ops",
    currentStep: "execute",
  },
];

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.mockInvalidateQueries,
  }),
}));

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mocks.mockClient,
  useWorkflowsQuery: () => ({
    data: workflowData,
  }),
  useTasksQuery: () => mocks.mockUseTasksQuery(),
}));

vi.mock("@aa/shared-api-client", () => ({
  cancelWorkflow: mocks.mockCancelWorkflow,
  pauseWorkflow: mocks.mockPauseWorkflow,
  resumeWorkflow: mocks.mockResumeWorkflow,
  recoverWorkflow: mocks.mockRecoverWorkflow,
  releaseWorkflow: mocks.mockReleaseWorkflow,
}));

import { useWorkflowCockpitVm } from "../../../../../../packages/features/workflow-cockpit/src/hooks";

describe("useWorkflowCockpitVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workflowData = [
      {
        id: "workflow-1",
        title: "real_task_execution",
        status: "running",
        currentStage: "execute",
        owner: "platform",
        domainId: "platform",
        steps: [],
      },
    ] as const;
    taskData = [
      {
        id: "workflow-1",
        title: "Campaign Launch",
        status: "running",
        domainId: "growth-ops",
        currentStep: "execute",
      },
    ] as const;
    mocks.mockUseTasksQuery.mockReturnValue({ data: taskData });
    mocks.mockClient.get.mockResolvedValue({
      summary: {
        taskId: "workflow-1",
        workflowId: "real_task_execution",
        workflowStatus: "completed",
        currentStepIndex: 1,
        divisionId: "growth-ops",
      },
      inspect: {
        task: {
          id: "workflow-1",
          title: "Campaign Launch",
          divisionId: "growth-ops",
        },
        workflowState: {
          workflowId: "real_task_execution",
          status: "completed",
          currentStepIndex: 1,
          resumableFromStep: "execute",
        },
        approvals: [
          {
            approvalId: "approval-1",
            title: "Risk Review",
            status: "pending",
            approverId: "domain-admin",
          },
        ],
        stepOutputs: [
          {
            id: "step-1",
            stepId: "real_model",
            roleId: "minimax",
            status: "succeeded",
            summary: "Generate report",
            producedAt: "2026-05-04T00:01:00Z",
          },
        ],
        artifacts: [
          {
            artifactId: "artifact-1",
            kind: "report_markdown",
            fileName: "report.md",
            storagePath: "artifact://report.md",
          },
        ],
      },
    });
  });

  it("calls allowed workflow control APIs for running workflows", async () => {
    mocks.mockClient.get.mockResolvedValue({
      summary: {
        taskId: "workflow-1",
        workflowId: "real_task_execution",
        workflowStatus: "running",
        currentStepIndex: 0,
        divisionId: "growth-ops",
      },
      inspect: {
        task: {
          id: "workflow-1",
          title: "Campaign Launch",
          divisionId: "growth-ops",
          status: "running",
        },
        workflowState: {
          workflowId: "real_task_execution",
          status: "running",
          currentStepIndex: 0,
          resumableFromStep: "execute",
        },
        approvals: [],
        stepOutputs: [],
        artifacts: [],
      },
    });

    const { result } = renderHook(() => useWorkflowCockpitVm());

    act(() => {
      result.current.selectWorkflow("workflow-1");
    });

    await act(async () => {
      await result.current.pauseWorkflow();
      await result.current.cancelWorkflow();
      await result.current.releaseWorkflow();
    });

    expect(mocks.mockPauseWorkflow).toHaveBeenCalledWith(mocks.mockClient, "workflow-1");
    expect(mocks.mockCancelWorkflow).toHaveBeenCalledWith(mocks.mockClient, "workflow-1");
    expect(mocks.mockReleaseWorkflow).toHaveBeenCalledWith(mocks.mockClient, "workflow-1");
    expect(mocks.mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["workflows"] });

    await waitFor(() => {
      expect(result.current.activityItems[0]?.title).toContain("Campaign Launch");
    });
  });

  it("disables invalid actions for paused workflows", async () => {
    mocks.mockClient.get.mockResolvedValue({
      summary: {
        taskId: "workflow-1",
        workflowId: "real_task_execution",
        workflowStatus: "paused",
        currentStepIndex: 0,
        divisionId: "growth-ops",
        taskStatus: "awaiting_decision",
      },
      inspect: {
        task: {
          id: "workflow-1",
          title: "Campaign Launch",
          divisionId: "growth-ops",
          status: "awaiting_decision",
        },
        workflowState: {
          workflowId: "real_task_execution",
          status: "paused",
          currentStepIndex: 0,
          resumableFromStep: "execute",
        },
        approvals: [],
        stepOutputs: [],
        artifacts: [],
      },
    });

    const { result } = renderHook(() => useWorkflowCockpitVm());

    act(() => {
      result.current.selectWorkflow("workflow-1");
    });

    await waitFor(() => {
      expect(result.current.selectedWorkflow?.status).toBe("paused");
    });

    expect(result.current.controls).toEqual({
      cancelEnabled: true,
      pauseEnabled: false,
      resumeEnabled: true,
      recoverEnabled: false,
      releaseEnabled: false,
    });

    await act(async () => {
      await result.current.pauseWorkflow();
      await result.current.recoverWorkflow();
      await result.current.releaseWorkflow();
    });

    expect(mocks.mockPauseWorkflow).not.toHaveBeenCalled();
    expect(mocks.mockRecoverWorkflow).not.toHaveBeenCalled();
    expect(mocks.mockReleaseWorkflow).not.toHaveBeenCalled();
  });

  it("enables recovery controls for failed workflows only", async () => {
    mocks.mockClient.get.mockResolvedValue({
      summary: {
        taskId: "workflow-1",
        workflowId: "real_task_execution",
        workflowStatus: "failed",
        currentStepIndex: 0,
        divisionId: "growth-ops",
        taskStatus: "failed",
      },
      inspect: {
        task: {
          id: "workflow-1",
          title: "Campaign Launch",
          divisionId: "growth-ops",
          status: "failed",
        },
        workflowState: {
          workflowId: "real_task_execution",
          status: "failed",
          currentStepIndex: 0,
          resumableFromStep: "execute",
        },
        approvals: [],
        stepOutputs: [],
        artifacts: [],
      },
    });

    const { result } = renderHook(() => useWorkflowCockpitVm());

    act(() => {
      result.current.selectWorkflow("workflow-1");
    });

    await waitFor(() => {
      expect(result.current.selectedWorkflow?.status).toBe("failed");
    });

    expect(result.current.controls).toEqual({
      cancelEnabled: false,
      pauseEnabled: false,
      resumeEnabled: false,
      recoverEnabled: true,
      releaseEnabled: false,
    });

    await act(async () => {
      await result.current.recoverWorkflow();
    });

    expect(mocks.mockRecoverWorkflow).toHaveBeenCalledWith(mocks.mockClient, "workflow-1");
  });

  it("reflects upstream workflow query changes without mirroring the full list into local state", async () => {
    const { result, rerender } = renderHook(() => useWorkflowCockpitVm());

    expect(result.current.listItems[0]).toEqual({
      id: "workflow-1",
      title: "Campaign Launch",
      subtitle: "running · execute",
    });

    workflowData = [
      {
        ...(workflowData[0] as WorkflowDTO),
        status: "paused",
        currentStage: "waiting_hitl",
      },
    ];
    rerender();

    await waitFor(() => {
      expect(result.current.listItems[0]?.subtitle).toBe("paused · waiting_hitl");
    });
  });

  it("auto-selects the highest-priority workflow instead of leaving the detail pane empty", async () => {
    workflowData = [
      {
        id: "workflow-completed",
        title: "Completed workflow",
        status: "completed",
        currentStage: "step-1",
        owner: "platform",
        domainId: "platform",
        steps: [],
      },
      {
        id: "workflow-failed",
        title: "Failed workflow",
        status: "failed",
        currentStage: "real_model",
        owner: "platform",
        domainId: "platform",
        steps: [],
      },
    ] as const;
    taskData = [
      {
        id: "workflow-completed",
        title: "Completed workflow",
        status: "completed",
        domainId: "platform",
        currentStep: "step-1",
      },
      {
        id: "workflow-failed",
        title: "Failed workflow",
        status: "failed",
        domainId: "platform",
        currentStep: "real_model",
      },
    ] as const;
    mocks.mockUseTasksQuery.mockReturnValue({ data: taskData });
    mocks.mockClient.get.mockResolvedValue({
      summary: {
        taskId: "workflow-failed",
        workflowId: "real_task_execution",
        workflowStatus: "failed",
        currentStepIndex: 0,
        divisionId: "platform",
        taskStatus: "failed",
      },
      inspect: {
        task: {
          id: "workflow-failed",
          title: "Failed workflow",
          divisionId: "platform",
          status: "failed",
        },
        workflowState: {
          workflowId: "real_task_execution",
          status: "failed",
          currentStepIndex: 0,
          resumableFromStep: "real_model",
        },
        approvals: [],
        stepOutputs: [],
        artifacts: [],
      },
    });

    const { result } = renderHook(() => useWorkflowCockpitVm());

    await waitFor(() => {
      expect(result.current.selectedId).toBe("workflow-failed");
    });

    expect(result.current.listItems.map((item) => item.id)).toEqual([
      "workflow-failed",
      "workflow-completed",
    ]);
    expect(mocks.mockClient.get).toHaveBeenCalledWith("/v1/workflows/workflow-failed");
  });

  it("loads workflow detail from the real workflow cockpit endpoint", async () => {
    const { result } = renderHook(() => useWorkflowCockpitVm());

    act(() => {
      result.current.selectWorkflow("workflow-1");
    });

    await waitFor(() => {
      expect(mocks.mockClient.get).toHaveBeenCalledWith("/v1/workflows/workflow-1");
      expect(result.current.selectedWorkflow).toEqual(expect.objectContaining({
        id: "workflow-1",
        title: "Campaign Launch",
        owner: "platform",
        domainId: "growth-ops",
      }));
      expect(result.current.selectedWorkflow?.steps[0]).toEqual(expect.objectContaining({
        id: "step-1",
        title: "Generate report",
        status: "completed",
      }));
      expect(result.current.selectedWorkflow?.approvalNodes?.[0]).toEqual({
        nodeId: "approval-1",
        title: "Risk Review",
        status: "pending",
        assignee: "domain-admin",
      });
      expect(result.current.selectedWorkflow?.evidenceRefs?.[0]).toEqual({
        refId: "artifact-1",
        type: "report",
        uri: "artifact://report.md",
        description: "report.md",
      });
    });
  });

  it("preserves failed workflow state from real workflow responses", async () => {
    workflowData = [
      {
        id: "ui-task-retry-1",
        title: "UI retry cleanup seed",
        status: "failed",
        currentStage: "step-0",
        owner: "default",
        domainId: "default",
        steps: [],
      },
    ] as const;
    taskData = [
      {
        id: "ui-task-retry-1",
        title: "UI retry cleanup seed",
        status: "failed",
        domainId: "default",
        currentStep: "step-0",
      },
    ] as const;
    mocks.mockUseTasksQuery.mockReturnValue({ data: taskData });
    mocks.mockClient.get.mockResolvedValueOnce({
      summary: {
        taskId: "ui-task-retry-1",
        workflowId: "ui-workflow-retry-1",
        workflowStatus: "failed",
        currentStepIndex: 0,
        divisionId: "default",
        taskStatus: "failed",
      },
      inspect: {
        task: {
          id: "ui-task-retry-1",
          title: "UI retry cleanup seed",
          divisionId: "default",
          status: "failed",
        },
        workflowState: {
          workflowId: "ui-workflow-retry-1",
          status: "failed",
          currentStepIndex: 0,
          resumableFromStep: "step-0",
        },
      },
    });

    const { result } = renderHook(() => useWorkflowCockpitVm());

    expect(result.current.listItems[0]).toEqual({
      id: "ui-task-retry-1",
      title: "UI retry cleanup seed",
      subtitle: "failed · step-0",
    });

    act(() => {
      result.current.selectWorkflow("ui-task-retry-1");
    });

    await waitFor(() => {
      expect(result.current.selectedWorkflow).toEqual(expect.objectContaining({
        id: "ui-task-retry-1",
        status: "failed",
        currentStage: "step-0",
      }));
    });
  });
});
