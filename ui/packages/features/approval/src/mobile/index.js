import { approveApproval, rejectApproval } from "@aa/shared-api-client";
import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createApprovalMobileCards(approvals, client) {
    return approvals.slice(0, 5).flatMap((approval) => {
        const approveCard = {
            id: `${approval.approvalId}:approve`,
            actionType: "approve",
            ...createMobileFeatureCard(approval.taskId, `${approval.riskLevel} · ${approval.reasonSummary}`, approval.approvalId),
            async onApprove() {
                if (client == null) {
                    return;
                }
                await approveApproval(client, approval.approvalId);
            },
        };
        const rejectCard = {
            id: `${approval.approvalId}:reject`,
            actionType: "reject",
            ...createMobileFeatureCard(approval.taskId, `${approval.riskLevel} · ${approval.reasonSummary}`, approval.approvalId),
            async onReject() {
                if (client == null) {
                    return;
                }
                await rejectApproval(client, approval.approvalId);
            },
        };
        return [approveCard, rejectCard];
    });
}
