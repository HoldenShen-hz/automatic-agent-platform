import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { ApprovalDTO } from "@aa/shared-types";

export function createApprovalMobileCards(approvals: readonly ApprovalDTO[]) {
  return approvals.slice(0, 3).map((approval) => createMobileFeatureCard(
    approval.taskId,
    `${approval.riskLevel} · ${approval.reasonSummary}`,
    approval.approvalId,
  ));
}
