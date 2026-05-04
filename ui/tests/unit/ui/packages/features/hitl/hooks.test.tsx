import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockClient = { post: vi.fn() };
const mockWsClient = { subscribe: vi.fn(() => () => undefined) };
const mockFetchApprovals = vi.fn(async () => ([
  {
    approvalId: "approval-1",
    taskId: "task-1",
    riskLevel: "high",
    reasonSummary: "Patch required",
  },
  {
    approvalId: "approval-2",
    taskId: "task-2",
    riskLevel: "medium",
    reasonSummary: "Override required",
  },
]));
const mockSubmitApprovalTextInput = vi.fn(async () => ({ ok: true }));

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mockClient,
  useWsClient: () => mockWsClient,
}));

vi.mock("@aa/shared-api-client", () => ({
  fetchApprovals: (...args: unknown[]) => mockFetchApprovals(...args),
  approveApproval: vi.fn(async () => ({ ok: true })),
  rejectApproval: vi.fn(async () => ({ ok: true })),
  delegateApproval: vi.fn(async () => ({ ok: true })),
  resumeWorkflow: vi.fn(async () => ({ ok: true })),
  submitApprovalTextInput: (...args: unknown[]) => mockSubmitApprovalTextInput(...args),
}));

import { useHitlVm } from "../../../../../../packages/features/hitl/src/hooks";

describe("useHitlVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits patch actions through the approval decision API and removes the item", async () => {
    const { result } = renderHook(() => useHitlVm());

    await waitFor(() => {
      expect(result.current.items.map((item) => item.id)).toEqual(["approval-1", "approval-2"]);
    });

    await act(async () => {
      await result.current.patch("approval-1", { field: "value" });
    });

    expect(mockSubmitApprovalTextInput).toHaveBeenCalledWith(
      mockClient,
      "approval-1",
      JSON.stringify({ action: "patch", patch: { field: "value" } }),
    );
    await waitFor(() => {
      expect(result.current.items.map((item) => item.id)).toEqual(["approval-2"]);
    });
  });

  it("submits override actions through the approval decision API and removes the item", async () => {
    const { result } = renderHook(() => useHitlVm());

    await waitFor(() => {
      expect(result.current.items.map((item) => item.id)).toEqual(["approval-1", "approval-2"]);
    });

    await act(async () => {
      await result.current.override("approval-2", { mode: "full" });
    });

    expect(mockSubmitApprovalTextInput).toHaveBeenCalledWith(
      mockClient,
      "approval-2",
      JSON.stringify({ action: "override", override: { mode: "full" } }),
    );
    await waitFor(() => {
      expect(result.current.items.map((item) => item.id)).toEqual(["approval-1"]);
    });
  });
});
