import { useEffect, useMemo, useState } from "react";
import type { ApprovalDTO } from "@aa/shared-types";
import { useApprovalsQuery } from "@aa/shared-state";

export interface ApprovalCenterVm {
  readonly approvals: readonly ApprovalDTO[];
  readonly queueItems: readonly { id: string; title: string; subtitle: string }[];
  readonly selectedId: string | null;
  readonly selectedApproval: ApprovalDTO | null;
  readonly actionHistory: readonly { title: string; description: string }[];
  readonly queueDepth: number;
  selectApproval(id: string): void;
  approve(): void;
  reject(): void;
  delegate(target: string): void;
}

export function mapApprovalsToVm(approvals: readonly ApprovalDTO[]): Pick<ApprovalCenterVm, "approvals" | "queueItems" | "queueDepth"> {
  return {
    approvals,
    queueItems: approvals.map((approval) => ({
      id: approval.approvalId,
      title: approval.taskId,
      subtitle: approval.riskLevel,
    })),
    queueDepth: approvals.length,
  };
}

export function useApprovalCenterVm(): ApprovalCenterVm {
  const queryApprovals = useApprovalsQuery().data ?? [];
  const [approvals, setApprovals] = useState<readonly ApprovalDTO[]>(queryApprovals);
  const [selectedId, setSelectedId] = useState<string | null>(queryApprovals[0]?.approvalId ?? null);
  const [actionHistory, setActionHistory] = useState<readonly { title: string; description: string }[]>([]);

  useEffect(() => {
    setApprovals(queryApprovals);
    setSelectedId((current) => current ?? queryApprovals[0]?.approvalId ?? null);
  }, [queryApprovals]);

  const baseVm = useMemo(() => mapApprovalsToVm(approvals), [approvals]);
  const selectedApproval = approvals.find((approval) => approval.approvalId === selectedId) ?? approvals[0] ?? null;

  function resolveNextSelection(nextApprovals: readonly ApprovalDTO[]): void {
    setSelectedId(nextApprovals[0]?.approvalId ?? null);
  }

  function removeSelected(decision: string): void {
    if (selectedApproval == null) {
      return;
    }
    const nextApprovals = approvals.filter((approval) => approval.approvalId !== selectedApproval.approvalId);
    setApprovals(nextApprovals);
    resolveNextSelection(nextApprovals);
    setActionHistory((history) => [
      {
        title: `${decision} · ${selectedApproval.taskId}`,
        description: `${selectedApproval.riskLevel} risk request processed through HITL workflow.`,
      },
      ...history,
    ]);
  }

  return {
    ...baseVm,
    selectedId,
    selectedApproval,
    actionHistory,
    selectApproval(id: string) {
      setSelectedId(id);
    },
    approve() {
      removeSelected("Approved");
    },
    reject() {
      removeSelected("Rejected");
    },
    delegate(target: string) {
      if (selectedApproval == null) {
        return;
      }
      setActionHistory((history) => [
        {
          title: `Delegated · ${selectedApproval.taskId}`,
          description: `Approval was delegated to ${target} for supervised decision.`,
        },
        ...history,
      ]);
    },
  };
}
