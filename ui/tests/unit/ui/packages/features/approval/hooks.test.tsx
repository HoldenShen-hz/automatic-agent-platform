import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockClient: { post: vi.fn() },
  mockApproveApproval: vi.fn(async () => ({ ok: true })),
  mockRejectApproval: vi.fn(async () => ({ ok: true })),
  mockDelegateApproval: vi.fn(async () => ({ ok: true })),
  mockRequestMoreContextApproval: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mocks.mockClient,
  useApprovalsQuery: () => ({
    data: [
      {
        approvalId: "approval-1",
        taskId: "task-1",
        riskLevel: "high",
        reasonSummary: "Production rollout",
      },
      {
        approvalId: "approval-2",
        taskId: "task-2",
        riskLevel: "medium",
        reasonSummary: "Shadow deploy",
      },
    ],
  }),
}));

vi.mock("@aa/shared-api-client", () => ({
  approveApproval: mocks.mockApproveApproval,
  rejectApproval: mocks.mockRejectApproval,
  delegateApproval: mocks.mockDelegateApproval,
  requestMoreContextApproval: mocks.mockRequestMoreContextApproval,
}));

import { useApprovalCenterVm } from "../../../../../../packages/features/approval/src/hooks/index";

describe("useApprovalCenterVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls approveApproval and removes the approved item from local state", async () => {
    const { result } = renderHook(() => useApprovalCenterVm());

    await act(async () => {
      await result.current.approve();
    });

    expect(mocks.mockApproveApproval).toHaveBeenCalledWith(mocks.mockClient, "approval-1");
    await waitFor(() => {
      expect(result.current.approvals.map((approval) => approval.approvalId)).toEqual(["approval-2"]);
    });
  });

  it("calls rejectApproval and removes the rejected item from local state", async () => {
    const { result } = renderHook(() => useApprovalCenterVm());

    await act(async () => {
      await result.current.reject();
    });

    expect(mocks.mockRejectApproval).toHaveBeenCalledWith(mocks.mockClient, "approval-1");
    await waitFor(() => {
      expect(result.current.approvals.map((approval) => approval.approvalId)).toEqual(["approval-2"]);
    });
  });

  it("calls requestMoreContextApproval for the selected approval", async () => {
    const { result } = renderHook(() => useApprovalCenterVm());

    await act(async () => {
      await result.current.requestMoreContext();
    });

    expect(mocks.mockRequestMoreContextApproval).toHaveBeenCalledWith(mocks.mockClient, "approval-1");
    await waitFor(() => {
      expect(result.current.actionHistory[0]?.title).toContain("Requested Context");
    });
  });

  it("removes the delegated approval from the actionable queue and selects the next item", async () => {
    const { result } = renderHook(() => useApprovalCenterVm());

    await act(async () => {
      await result.current.delegate("domain-admin");
    });

    expect(mocks.mockDelegateApproval).toHaveBeenCalledWith(mocks.mockClient, "approval-1", "domain-admin");
    await waitFor(() => {
      expect(result.current.approvals.map((approval) => approval.approvalId)).toEqual(["approval-2"]);
      expect(result.current.selectedId).toBe("approval-2");
    });
  });

  it("restores the approval queue when an optimistic approve call fails", async () => {
    mocks.mockApproveApproval.mockRejectedValueOnce(new Error("approval-write-failed"));
    const { result } = renderHook(() => useApprovalCenterVm());

    await act(async () => {
      await expect(result.current.approve()).rejects.toThrow(/approval-write-failed/);
    });

    expect(result.current.approvals.map((approval) => approval.approvalId)).toEqual(["approval-1", "approval-2"]);
    expect(result.current.selectedId).toBe("approval-1");
  });
});
