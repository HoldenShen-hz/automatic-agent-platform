import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockClient = { post: vi.fn() };
const mockApproveApproval = vi.fn(async () => ({ ok: true }));
const mockRejectApproval = vi.fn(async () => ({ ok: true }));
const mockDelegateApproval = vi.fn(async () => ({ ok: true }));
const mockRequestMoreContextApproval = vi.fn(async () => ({ ok: true }));

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mockClient,
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
  approveApproval: (...args: unknown[]) => mockApproveApproval(...args),
  rejectApproval: (...args: unknown[]) => mockRejectApproval(...args),
  delegateApproval: (...args: unknown[]) => mockDelegateApproval(...args),
  requestMoreContextApproval: (...args: unknown[]) => mockRequestMoreContextApproval(...args),
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

    expect(mockApproveApproval).toHaveBeenCalledWith(mockClient, "approval-1");
    await waitFor(() => {
      expect(result.current.approvals.map((approval) => approval.approvalId)).toEqual(["approval-2"]);
    });
  });

  it("calls rejectApproval and removes the rejected item from local state", async () => {
    const { result } = renderHook(() => useApprovalCenterVm());

    await act(async () => {
      await result.current.reject();
    });

    expect(mockRejectApproval).toHaveBeenCalledWith(mockClient, "approval-1");
    await waitFor(() => {
      expect(result.current.approvals.map((approval) => approval.approvalId)).toEqual(["approval-2"]);
    });
  });

  it("calls requestMoreContextApproval for the selected approval", async () => {
    const { result } = renderHook(() => useApprovalCenterVm());

    await act(async () => {
      await result.current.requestMoreContext();
    });

    expect(mockRequestMoreContextApproval).toHaveBeenCalledWith(mockClient, "approval-1");
    await waitFor(() => {
      expect(result.current.actionHistory[0]?.title).toContain("Requested Context");
    });
  });
});
