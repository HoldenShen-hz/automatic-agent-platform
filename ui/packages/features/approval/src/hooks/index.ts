import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApprovalDTO } from "@aa/shared-types";
import { useApprovalsQuery, useRestClient } from "@aa/shared-state";
import { approveApproval, rejectApproval, delegateApproval, requestMoreContextApproval } from "@aa/shared-api-client"; // §210-2493: add requestMoreContextApproval

export interface ApprovalCenterVm {
  readonly approvals: readonly ApprovalDTO[];
  readonly queueItems: readonly { id: string; title: string; subtitle: string }[];
  readonly selectedId: string | null;
  readonly selectedApproval: ApprovalDTO | null;
  readonly actionHistory: readonly { title: string; description: string }[];
  readonly queueDepth: number;
  readonly pendingAction: boolean;
  selectApproval(id: string): void;
  approve(): Promise<void>;
  reject(): Promise<void>;
  delegate(target: string): Promise<void>;
  requestMoreContext(): Promise<void>;
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
  const client = useRestClient();
  const queryApprovals = useApprovalsQuery().data ?? [];
  const approvalFeedVersion = queryApprovals
    .map((approval) => `${approval.approvalId}:${approval.taskId}:${approval.riskLevel}:${approval.reasonSummary}`)
    .join("|");
  const [approvals, setApprovals] = useState<readonly ApprovalDTO[]>(queryApprovals);
  const [selectedId, setSelectedId] = useState<string | null>(queryApprovals[0]?.approvalId ?? null);
  const [actionHistory, setActionHistory] = useState<readonly { title: string; description: string }[]>([]);
  const [pendingAction, setPendingAction] = useState(false);

  useEffect(() => {
    setApprovals(queryApprovals);
    setSelectedId((current) => {
      if (current != null && queryApprovals.some((approval) => approval.approvalId === current)) {
        return current;
      }
      return queryApprovals[0]?.approvalId ?? null;
    });
  }, [approvalFeedVersion]);

  const baseVm = useMemo(() => mapApprovalsToVm(approvals), [approvals]);
  const selectedApproval = approvals.find((approval) => approval.approvalId === selectedId) ?? approvals[0] ?? null;

  function resolveNextSelection(nextApprovals: readonly ApprovalDTO[]): void {
    setSelectedId(nextApprovals[0]?.approvalId ?? null);
  }

  const approve = useCallback(async (): Promise<void> => {
    if (selectedApproval == null) return;
    setPendingAction(true);
    try {
      await approveApproval(client, selectedApproval.approvalId);
      const nextApprovals = approvals.filter((approval) => approval.approvalId !== selectedApproval.approvalId);
      setApprovals(nextApprovals);
      resolveNextSelection(nextApprovals);
      setActionHistory((history) => [
        {
          title: `Approved · ${selectedApproval.taskId}`,
          description: `${selectedApproval.riskLevel} risk request processed through HITL workflow.`,
        },
        ...history,
      ]);
    } finally {
      setPendingAction(false);
    }
  }, [client, selectedApproval, approvals]);

  const reject = useCallback(async (): Promise<void> => {
    if (selectedApproval == null) return;
    setPendingAction(true);
    try {
      await rejectApproval(client, selectedApproval.approvalId);
      const nextApprovals = approvals.filter((approval) => approval.approvalId !== selectedApproval.approvalId);
      setApprovals(nextApprovals);
      resolveNextSelection(nextApprovals);
      setActionHistory((history) => [
        {
          title: `Rejected · ${selectedApproval.taskId}`,
          description: `${selectedApproval.riskLevel} risk request processed through HITL workflow.`,
        },
        ...history,
      ]);
    } finally {
      setPendingAction(false);
    }
  }, [client, selectedApproval, approvals]);

  const delegate = useCallback(async (target: string): Promise<void> => {
    if (selectedApproval == null) return;
    setPendingAction(true);
    try {
      await delegateApproval(client, selectedApproval.approvalId, target);
      setActionHistory((history) => [
        {
          title: `Delegated · ${selectedApproval.taskId}`,
          description: `Approval was delegated to ${target} for supervised decision.`,
        },
        ...history,
      ]);
    } finally {
      setPendingAction(false);
    }
  }, [client, selectedApproval]);

  const requestMoreContext = useCallback(async (): Promise<void> => {
    // §4.6.2: request_more_context action - asks the execution engine for additional context
    if (selectedApproval == null) return;
    setPendingAction(true);
    try {
      // §210-2493: Root cause - requestMoreContextApproval was listed in imports but never defined in shared-api-client
      // Fix: call the newly added requestMoreContextApproval API
      await requestMoreContextApproval(client, selectedApproval.approvalId);
      setActionHistory((history) => [
        {
          title: `Requested Context · ${selectedApproval.taskId}`,
          description: "Additional context has been requested from the execution engine.",
        },
        ...history,
      ]);
    } finally {
      setPendingAction(false);
    }
  }, [client, selectedApproval]);

  return {
    ...baseVm,
    selectedId,
    selectedApproval,
    actionHistory,
    pendingAction,
    selectApproval(id: string) {
      setSelectedId(id);
    },
    approve,
    reject,
    delegate,
    requestMoreContext,
  };
}
