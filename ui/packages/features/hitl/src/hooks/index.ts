import { useCallback, useEffect, useMemo, useState } from "react";
import { useRestClient, useWsClient } from "@aa/shared-state";
import type { ApprovalDTO } from "@aa/shared-types";
import {
  approveApproval,
  deferApproval,
  editApproval,
  escalateApproval,
  fetchApprovals,
  rejectApproval,
  resumeWorkflow,
  submitApprovalTextInput,
} from "@aa/shared-api-client";

export interface HitlItem {
  readonly id: string;
  readonly type: "approval" | "resume";
  readonly title: string;
  readonly description: string;
  readonly deadline?: string;
  readonly escalationTarget?: string;
  readonly secondsRemaining?: number;
}

export interface HitlVm {
  readonly items: readonly HitlItem[];
  readonly isLoading: boolean;
  readonly pendingOperations: number;
  approve(approvalId: string): Promise<void>;
  reject(approvalId: string): Promise<void>;
  patch(approvalId: string, patch: Record<string, unknown>): Promise<void>;
  override(approvalId: string, override: Record<string, unknown>): Promise<void>;
  edit(approvalId: string, patch: Record<string, unknown>): Promise<void>;
  escalate(approvalId: string, reason: string): Promise<void>;
  defer(approvalId: string, until: string): Promise<void>;
  resume(workflowId: string, mode: "normal" | "replan" | "supervised" | "abort"): Promise<void>;
  bulkApprove(approvalIds: readonly string[]): Promise<void>;
  bulkReject(approvalIds: readonly string[]): Promise<void>;
}

function toHitlItems(approvals: readonly ApprovalDTO[]): readonly HitlItem[] {
  return approvals.map((approval) => {
    const secondsRemaining = approval.deadline == null
      ? undefined
      : Math.max(0, Math.floor((new Date(approval.deadline).getTime() - Date.now()) / 1000));
    return {
      id: approval.approvalId,
      type: "approval",
      title: approval.taskId,
      description: `${approval.riskLevel} · ${approval.reasonSummary}`,
      deadline: approval.deadline,
      escalationTarget: approval.escalationTarget,
      secondsRemaining,
    };
  });
}

export function useHitlVm(): HitlVm {
  const client = useRestClient();
  const wsClient = useWsClient();
  const [approvals, setApprovals] = useState<readonly ApprovalDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingOperations, setPendingOperations] = useState(0);

  useEffect(() => {
    let mounted = true;
    void fetchApprovals(client)
      .then((items) => {
        if (mounted) {
          setApprovals(items);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setApprovals([]);
          setIsLoading(false);
        }
      });

    const unsubscribe = wsClient.subscribe("approvals", () => undefined);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [client, wsClient]);

  const items = useMemo(() => toHitlItems(approvals), [approvals]);

  const withPending = useCallback(async (operation: () => Promise<void>) => {
    setPendingOperations((current) => current + 1);
    try {
      await operation();
    } finally {
      setPendingOperations((current) => Math.max(0, current - 1));
    }
  }, []);

  const removeApproval = useCallback((approvalId: string) => {
    setApprovals((current) => current.filter((approval) => approval.approvalId !== approvalId));
  }, []);

  const approve = useCallback(async (approvalId: string) => {
    await withPending(async () => {
      await approveApproval(client, approvalId);
      removeApproval(approvalId);
    });
  }, [client, removeApproval, withPending]);

  const reject = useCallback(async (approvalId: string) => {
    await withPending(async () => {
      await rejectApproval(client, approvalId);
      removeApproval(approvalId);
    });
  }, [client, removeApproval, withPending]);

  const patch = useCallback(async (approvalId: string, patchPayload: Record<string, unknown>) => {
    await withPending(async () => {
      await submitApprovalTextInput(client, approvalId, JSON.stringify({ action: "patch", patch: patchPayload }));
      removeApproval(approvalId);
    });
  }, [client, removeApproval, withPending]);

  const override = useCallback(async (approvalId: string, overridePayload: Record<string, unknown>) => {
    await withPending(async () => {
      await submitApprovalTextInput(client, approvalId, JSON.stringify({ action: "override", override: overridePayload }));
      removeApproval(approvalId);
    });
  }, [client, removeApproval, withPending]);

  const edit = useCallback(async (approvalId: string, patchPayload: Record<string, unknown>) => {
    await withPending(async () => {
      await editApproval(client, approvalId, patchPayload);
    });
  }, [client, withPending]);

  const escalate = useCallback(async (approvalId: string, reason: string) => {
    await withPending(async () => {
      await escalateApproval(client, approvalId, reason);
    });
  }, [client, withPending]);

  const defer = useCallback(async (approvalId: string, until: string) => {
    await withPending(async () => {
      await deferApproval(client, approvalId, until);
    });
  }, [client, withPending]);

  const resume = useCallback(async (workflowId: string, mode: "normal" | "replan" | "supervised" | "abort") => {
    await withPending(async () => {
      await resumeWorkflow(client, workflowId, mode);
    });
  }, [client, withPending]);

  const bulkApprove = useCallback(async (approvalIds: readonly string[]) => {
    await withPending(async () => {
      await Promise.all(approvalIds.map((approvalId) => approveApproval(client, approvalId)));
      setApprovals((current) => current.filter((approval) => !approvalIds.includes(approval.approvalId)));
    });
  }, [client, withPending]);

  const bulkReject = useCallback(async (approvalIds: readonly string[]) => {
    await withPending(async () => {
      await Promise.all(approvalIds.map((approvalId) => rejectApproval(client, approvalId)));
      setApprovals((current) => current.filter((approval) => !approvalIds.includes(approval.approvalId)));
    });
  }, [client, withPending]);

  return {
    items,
    isLoading,
    pendingOperations,
    approve,
    reject,
    patch,
    override,
    edit,
    escalate,
    defer,
    resume,
    bulkApprove,
    bulkReject,
  };
}
