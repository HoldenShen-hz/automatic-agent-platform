import { describe, expect, it, vi } from "vitest";

import { createApprovalMobileCards } from "../../../../../../packages/features/approval/src/mobile/index";

vi.mock("@aa/shared-api-client", () => ({
  approveApproval: vi.fn(async (_client: unknown, approvalId: string) => ({ ok: true, approvalId })),
  rejectApproval: vi.fn(async (_client: unknown, approvalId: string) => ({ ok: true, approvalId })),
}));

describe("createApprovalMobileCards", () => {
  it("creates interactive approve and reject quick actions backed by API calls", async () => {
    const client = {
      post: vi.fn(async () => ({ ok: true })),
    };
    const approvals = [
      {
        approvalId: "approval-1",
        taskId: "task-production-rollout",
        riskLevel: "high",
        reasonSummary: "Promote release to production",
      },
    ];
    const { approveApproval, rejectApproval } = await import("@aa/shared-api-client");

    const cards = createApprovalMobileCards(approvals as any, client);

    expect(cards).toHaveLength(2);
    expect(cards[0]?.actionType).toBe("approve");
    expect(cards[1]?.actionType).toBe("reject");

    await cards[0]?.onApprove();
    await cards[1]?.onReject();

    expect(approveApproval).toHaveBeenCalledWith(client, "approval-1");
    expect(rejectApproval).toHaveBeenCalledWith(client, "approval-1");
  });

  it("limits approval notification cards to five source approvals", () => {
    const client = {
      post: vi.fn(async () => ({ ok: true })),
    };
    const approvals = Array.from({ length: 6 }, (_, index) => ({
      approvalId: `approval-${index + 1}`,
      taskId: `task-${index + 1}`,
      riskLevel: "medium",
      reasonSummary: `Reason ${index + 1}`,
    }));

    const cards = createApprovalMobileCards(approvals as any, client);

    expect(cards).toHaveLength(10);
    expect(cards.some((card) => card.id.startsWith("approval-6:"))).toBe(false);
  });
});
