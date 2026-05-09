import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApprovalDTO } from "@aa/shared-types";
import { useApprovalsQuery } from "@aa/shared-state";
import { useMutation } from "@aa/shared-state/mutations";
import { createRESTClient, approveApproval as approveApprovalApi, rejectApproval as rejectApprovalApi, delegateApproval as delegateApprovalApi } from "@aa/shared-api-client";

const restClient = createRESTClient();

export interface ApprovalCenterVm {
  readonly approvals: readonly ApprovalDTO[];
  readonly queueItems: readonly { id: string; title: string; subtitle: string }[];
  readonly selectedId: string | null;
  readonly selectedApproval: ApprovalDTO | null;
  readonly actionHistory: readonly { title: string; description: string }[];
  readonly queueDepth: number;
  readonly pendingOperations: number;
  selectApproval(id: string): void;
  approve(): Promise<void>;
  reject(): Promise<void>;
  delegate(target: string): Promise<void>;
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
  const approvalFeedVersion = queryApprovals
    .map((approval) => `${approval.approvalId}:${approval.taskId}:${approval.riskLevel}:${approval.reasonSummary}`)
    .join("|");
  const [approvals, setApprovals] = useState<readonly ApprovalDTO[]>(queryApprovals);
  const [selectedId, setSelectedId] = useState<string | null>(queryApprovals[0]?.approvalId ?? null);
  const [actionHistory, setActionHistory] = useState<readonly { title: string; description: string }[]>([]);
  const [pendingOperations, setPendingOperations] = useState(0);

  const { mutate: approveMutate, status: approveStatus } = useMutation({
    client: restClient,
    method: "POST",
    path: (variables: { approvalId: string }) => `/approvals/${variables.approvalId}/approve`,
  });

  const { mutate: rejectMutate, status: rejectStatus } = useMutation({
    client: restClient,
    method: "POST",
    path: (variables: { approvalId: string }) => `/approvals/${variables.approvalId}/reject`,
  });

  const { mutate: delegateMutate, status: delegateStatus } = useMutation({
    client: restClient,
    method: "POST",
    path: (variables: { approvalId: string; delegateTo: string }) => `/approvals/${variables.approvalId}/delegate`,
  });

  useEffect(() => {
    setApprovals(queryApprovals);
    setSelectedId((current) => {
      if (current != null && queryApprovals.some((approval) => approval.approvalId === current)) {
        return current;
      }
      return queryApprovals[0]?.approvalId ?? null;
    });
  }, [approvalFeedVersion]);

  useEffect(() => {
    const pending = [approveStatus, rejectStatus, delegateStatus].filter((s) => s === "pending").length;
    setPendingOperations(pending);
  }, [approveStatus, rejectStatus, delegateStatus]);

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

  const approve = useCallback(async () => {
    if (selectedApproval == null) return;
    removeSelected("Approved");
    return new Promise<void>((resolve, reject) => {
      approveMutate(
        { approvalId: selectedApproval.approvalId },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        },
      );
    });
  }, [selectedApproval, approveMutate]);

  const reject = useCallback(async () => {
    if (selectedApproval == null) return;
    removeSelected("Rejected");
    return new Promise<void>((resolve, reject) => {
      rejectMutate(
        { approvalId: selectedApproval.approvalId },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        },
      );
    });
  }, [selectedApproval, rejectMutate]);

  const delegate = useCallback(async (target: string) => {
    if (selectedApproval == null) return;
    setActionHistory((history) => [
      {
        title: `Delegated · ${selectedApproval.taskId}`,
        description: `Approval was delegated to ${target} for supervised decision.`,
      },
      ...history,
    ]);
    return new Promise<void>((resolve, reject) => {
      delegateMutate(
        { approvalId: selectedApproval.approvalId, delegateTo: target },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        },
      );
    });
  }, [selectedApproval, delegateMutate]);

  return {
    ...baseVm,
    selectedId,
    selectedApproval,
    actionHistory,
    pendingOperations,
    selectApproval(id: string) {
      setSelectedId(id);
    },
    approve,
    reject,
    delegate,
  };
}
