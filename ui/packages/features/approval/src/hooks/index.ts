import type { ApprovalDTO } from "@aa/shared-types";
import { useApprovalsQuery } from "@aa/shared-state";

export interface ApprovalCenterVm {
  readonly approvals: readonly ApprovalDTO[];
  readonly queueItems: readonly { id: string; title: string; subtitle: string }[];
}

export function mapApprovalsToVm(approvals: readonly ApprovalDTO[]): ApprovalCenterVm {
  return {
    approvals,
    queueItems: approvals.map((approval) => ({
      id: approval.approvalId,
      title: approval.taskId,
      subtitle: approval.riskLevel,
    })),
  };
}

export function useApprovalCenterVm(): ApprovalCenterVm {
  return mapApprovalsToVm(useApprovalsQuery().data ?? []);
}
