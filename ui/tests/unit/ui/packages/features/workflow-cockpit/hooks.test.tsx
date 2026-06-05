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

  it("calls workflow control APIs instead of mutating local state only", async () => {
    const { result } = renderHook(() => useWorkflowCockpitVm());

    act(() => {
      result.current.selectWorkflow("workflow-1");
    });

    await act(async () => {
      await result.current.pauseWorkflow();
      await result.current.cancelWorkflow();
      await result.current.resumeWorkflow();
      await result.current.recoverWorkflow();
      await result.current.releaseWorkflow();
    });

    expect(mocks.mockPauseWorkflow).toHaveBeenCalledWith(mocks.mockClient, "workflow-1");
    expect(mocks.mockCancelWorkflow).toHaveBeenCalledWith(mocks.mockClient, "workflow-1");
    expect(mocks.mockResumeWorkflow).toHaveBeenCalledWith(mocks.mockClient, "workflow-1");
    expect(mocks.mockRecoverWorkflow).toHaveBeenCalledWith(mocks.mockClient, "workflow-1");
    expect(mocks.mockReleaseWorkflow).toHaveBeenCalledWith(mocks.mockClient, "workflow-1");
    expect(mocks.mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["workflows"] });

    await waitFor(() => {
      expect(result.current.activityItems[0]?.title).toContain("Released");
    });
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
        owner: "growth-ops",
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
});
