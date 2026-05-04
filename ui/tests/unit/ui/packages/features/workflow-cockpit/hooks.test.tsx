import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClient = { post: vi.fn() };
const mockPauseWorkflow = vi.fn(async () => ({ ok: true }));
const mockResumeWorkflow = vi.fn(async () => ({ ok: true }));
const mockRecoverWorkflow = vi.fn(async () => ({ ok: true }));
const mockReleaseWorkflow = vi.fn(async () => ({ ok: true }));
const mockInvalidateQueries = vi.fn(async () => undefined);
let workflowData = [
  {
    id: "workflow-1",
    title: "Campaign Launch",
    status: "running",
    currentStage: "execute",
    owner: "growth-ops",
    steps: [{ id: "s1", title: "Plan", phase: "Plan", status: "completed" }],
  },
] as const;

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mockClient,
  useWorkflowsQuery: () => ({
    data: workflowData,
  }),
}));

vi.mock("@aa/shared-api-client", () => ({
  pauseWorkflow: (...args: unknown[]) => mockPauseWorkflow(...args),
  resumeWorkflow: (...args: unknown[]) => mockResumeWorkflow(...args),
  recoverWorkflow: (...args: unknown[]) => mockRecoverWorkflow(...args),
  releaseWorkflow: (...args: unknown[]) => mockReleaseWorkflow(...args),
}));

import { useWorkflowCockpitVm } from "../../../../../../packages/features/workflow-cockpit/src/hooks";

describe("useWorkflowCockpitVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workflowData = [
      {
        id: "workflow-1",
        title: "Campaign Launch",
        status: "running",
        currentStage: "execute",
        owner: "growth-ops",
        steps: [{ id: "s1", title: "Plan", phase: "Plan", status: "completed" }],
      },
    ] as const;
  });

  it("calls workflow control APIs instead of mutating local state only", async () => {
    const { result } = renderHook(() => useWorkflowCockpitVm());

    act(() => {
      result.current.selectWorkflow("workflow-1");
    });

    await act(async () => {
      await result.current.pauseWorkflow();
      await result.current.resumeWorkflow();
      await result.current.recoverWorkflow();
      await result.current.releaseWorkflow();
    });

    expect(mockPauseWorkflow).toHaveBeenCalledWith(mockClient, "workflow-1");
    expect(mockResumeWorkflow).toHaveBeenCalledWith(mockClient, "workflow-1");
    expect(mockRecoverWorkflow).toHaveBeenCalledWith(mockClient, "workflow-1");
    expect(mockReleaseWorkflow).toHaveBeenCalledWith(mockClient, "workflow-1");
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["workflows"] });

    await waitFor(() => {
      expect(result.current.activityItems[0]?.title).toContain("Released");
    });
  });

  it("reflects upstream workflow query changes without mirroring the full list into local state", async () => {
    const { result, rerender } = renderHook(() => useWorkflowCockpitVm());

    expect(result.current.listItems[0]?.subtitle).toBe("running · execute");

    workflowData = [
      {
        ...workflowData[0],
        status: "paused",
        currentStage: "waiting_hitl",
      },
    ] as const;
    rerender();

    await waitFor(() => {
      expect(result.current.listItems[0]?.subtitle).toBe("paused · waiting_hitl");
    });
  });
});
