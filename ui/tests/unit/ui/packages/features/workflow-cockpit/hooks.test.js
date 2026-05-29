import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
    mockClient: { post: vi.fn() },
    mockPauseWorkflow: vi.fn(async () => ({ ok: true })),
    mockCancelWorkflow: vi.fn(async () => ({ ok: true })),
    mockResumeWorkflow: vi.fn(async () => ({ ok: true })),
    mockRecoverWorkflow: vi.fn(async () => ({ ok: true })),
    mockReleaseWorkflow: vi.fn(async () => ({ ok: true })),
    mockInvalidateQueries: vi.fn(async () => undefined),
}));
let workflowData = [
    {
        id: "workflow-1",
        title: "Campaign Launch",
        status: "running",
        currentStage: "execute",
        owner: "growth-ops",
        steps: [{ id: "s1", title: "Plan", phase: "Plan", status: "completed" }],
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
                title: "Campaign Launch",
                status: "running",
                currentStage: "execute",
                owner: "growth-ops",
                steps: [{ id: "s1", title: "Plan", phase: "Plan", status: "completed" }],
            },
        ];
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
        expect(result.current.listItems[0]?.subtitle).toBe("running · execute");
        workflowData = [
            {
                ...workflowData[0],
                status: "paused",
                currentStage: "waiting_hitl",
            },
        ];
        rerender();
        await waitFor(() => {
            expect(result.current.listItems[0]?.subtitle).toBe("paused · waiting_hitl");
        });
    });
});
