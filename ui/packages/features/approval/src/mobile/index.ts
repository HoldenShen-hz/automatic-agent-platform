import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { ApprovalDTO } from "@aa/shared-types";
import { approveApproval, rejectApproval } from "@aa/shared-api-client"; // §210-2505: add API calls for quick actions

export interface ApprovalMobileAction {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly actionType: "approve" | "reject" | "delegate" | "request-context";
  readonly onApprove: () => Promise<void>; // §210-2505: add actual handler
  readonly onReject: () => Promise<void>; // §210-2505: add actual handler
}

/**
 * Creates interactive approval cards for mobile notification bar shortcuts.
 * Each card represents a quick action available from the mobile notification.
 */
export function createApprovalMobileCards(
  approvals: readonly ApprovalDTO[],
  client: { post: (path: string, body: unknown) => Promise<{ ok: boolean }> }, // §210-2505: add client param
): readonly ApprovalMobileAction[] {
  const cards: ApprovalMobileAction[] = [];

  for (const approval of approvals.slice(0, 5)) {
    const title = `${approval.riskLevel.toUpperCase()}: ${approval.taskId.slice(0, 12)}`;
    const description = `${approval.riskLevel} risk · ${approval.reasonSummary.slice(0, 30)}`;

    const handleApprove = async (): Promise<void> => {
      await approveApproval(client as Parameters<typeof approveApproval>[0], approval.approvalId);
    };
    const handleReject = async (): Promise<void> => {
      await rejectApproval(client as Parameters<typeof rejectApproval>[0], approval.approvalId);
    };

    cards.push({
      id: `${approval.approvalId}:approve`,
      title: `Approve: ${title}`,
      description,
      actionType: "approve",
      onApprove: handleApprove,
      onReject: handleReject,
    });
    cards.push({
      id: `${approval.approvalId}:reject`,
      title: `Reject: ${title}`,
      description,
      actionType: "reject",
      onApprove: handleApprove,
      onReject: handleReject,
    });
  }

  return cards;
}

/**
 * Creates feature overview cards for the approval center on mobile.
 */
export function createApprovalFeatureCards(): readonly { title: string; description: string }[] {
  return [
    { title: "Quick Approve", description: "Approve low-risk items directly from the queue" },
    { title: "Delegate", description: "Escalate to domain or org admin for review" },
    { title: "Request Context", description: "Ask execution engine for additional context" },
    { title: "Resume Mode", description: "Resume in normal or supervised mode after approval" },
  ];
}
