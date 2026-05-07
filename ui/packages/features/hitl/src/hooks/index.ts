import type { RESTClient, WSClient, WSEventEnvelope } from "@aa/shared-api-client";
import {
  fetchApprovals,
  approveApproval,
  rejectApproval,
  delegateApproval,
  resumeWorkflow,
  editApproval,
  escalateApproval,
  deferApproval,
  submitApprovalTextInput,
} from "@aa/shared-api-client";
import type { ApprovalDTO } from "@aa/shared-types";
import { useRestClient, useWsClient } from "@aa/shared-state";
import { useEffect, useState } from "react";

export type RecoveryMode = "normal" | "replan" | "supervised" | "abort";

export interface HitlItem {
  readonly id: string;
  readonly type: "approval" | "resume";
  readonly title: string;
  readonly description: string;
  readonly mode?: RecoveryMode;
  readonly planBundle?: unknown;
  readonly timestamp?: string;
}

export interface HitlVm {
  readonly items: readonly HitlItem[];
  readonly isLoading: boolean;
  approve(itemId: string): Promise<void>;
  reject(itemId: string): Promise<void>;
  edit(itemId: string, edits: Record<string, unknown>): Promise<void>;
  escalate(itemId: string, reason: string): Promise<void>;
  defer(itemId: string, until: string): Promise<void>;
  delegate(itemId: string, delegateTo: string): Promise<void>;
  resume(itemId: string, mode: RecoveryMode): Promise<void>;
  patch(itemId: string, patch: Record<string, unknown>): Promise<void>;
  override(itemId: string, override: Record<string, unknown>): Promise<void>;
}

// Default mock items for when no client is provided
// NOTE: These are fallback items for development only. Production should always use client.
const DEFAULT_HITL_ITEMS: readonly HitlItem[] = [
  { id: "inspect-default", type: "approval" as const, title: "Inspect", description: "查看当前 PlanBundle、Context 和执行状态。" },
  { id: "takeover-default", type: "approval" as const, title: "Takeover", description: "接管执行并写入人工操作记录。" },
  { id: "resume-default", type: "resume" as const, title: "Resume", description: "支持 normal、replan、supervised、abort 四种恢复模式。" },
  { id: "edit-default", type: "approval" as const, title: "Edit", description: "修改审批参数后再提交。" },
  { id: "escalate-default", type: "approval" as const, title: "Escalate", description: "升级审批至更高权限人员。" },
  { id: "defer-default", type: "approval" as const, title: "Defer", description: "延迟审批至指定时间。" },
];

/**
 * §4.6.2: Real HITL with approval routing, 4 recovery modes, and live PlanBundle display.
 * Fetches approvals from REST API and subscribes to WS events for real-time updates.
 * Falls back to static items when no client provided.
 */
export function useHitlVm(
  client?: RESTClient,
  wsClient?: WSClient,
  userId?: string,
): HitlVm {
  const sharedClient = useRestClient();
  const sharedWsClient = useWsClient();
  const effectiveClient = client ?? sharedClient;
  const effectiveWsClient = wsClient ?? sharedWsClient;
  const [items, setItems] = useState<readonly HitlItem[]>(DEFAULT_HITL_ITEMS);
  const [isLoading, setIsLoading] = useState(false);

  // §4.6.2: Fetch approval items from REST API when client provided
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void fetchApprovals(effectiveClient).then((approvals) => {
      if (cancelled) return;
      setItems(approvals.map((a: ApprovalDTO): HitlItem => ({
        id: a.approvalId,
        type: "approval",
        title: a.reasonSummary?.slice(0, 40) ?? `Approval: ${a.approvalId.slice(0, 8)}`,
        description: `Risk: ${a.riskLevel} - Task: ${a.taskId.slice(0, 8)}`,
      })));
      setIsLoading(false);
    }).catch(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [effectiveClient]);

  // §4.6.2: Subscribe to ws events for real-time approval updates
  useEffect(() => {
    if (userId == null) return;

    const channel = `approvals.${userId}`;
    const unsubscribe = effectiveWsClient.subscribe(channel, (event: WSEventEnvelope) => {
      if (event.type === "approval.created" || event.type === "approval.requested") {
        const payload = event.payload as ApprovalDTO;
        const newItem: HitlItem = {
          id: payload.approvalId,
          type: "approval",
          title: payload.reasonSummary?.slice(0, 40) ?? "New approval request",
          description: `Risk: ${payload.riskLevel ?? "unknown"} - Task: ${payload.taskId?.slice(0, 8) ?? "unknown"}`,
        };
        setItems((prev) => [...prev, newItem]);
      }
      if (event.type === "approval.resolved" || event.type === "approval.escalated") {
        const payload = event.payload as { approvalId?: string };
        if (payload.approvalId) {
          setItems((prev) => prev.filter((item) => item.id !== payload.approvalId));
        }
      }
    });

    return unsubscribe;
  }, [effectiveWsClient, userId]);

  async function approve(itemId: string): Promise<void> {
    await approveApproval(effectiveClient, itemId);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  async function reject(itemId: string): Promise<void> {
    await rejectApproval(effectiveClient, itemId);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  async function edit(itemId: string, edits: Record<string, unknown>): Promise<void> {
    await editApproval(effectiveClient, itemId, edits);
    setItems((prev) => prev.map((item) => item.id === itemId
      ? { ...item, description: `${item.description} · edited` }
      : item));
  }

  async function patch(itemId: string, patch: Record<string, unknown>): Promise<void> {
    await submitApprovalTextInput(
      effectiveClient,
      itemId,
      JSON.stringify({ action: "patch", patch }),
    );
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  async function override(itemId: string, override: Record<string, unknown>): Promise<void> {
    await submitApprovalTextInput(
      effectiveClient,
      itemId,
      JSON.stringify({ action: "override", override }),
    );
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  async function escalate(itemId: string, reason: string): Promise<void> {
    await escalateApproval(effectiveClient, itemId, reason);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  async function defer(itemId: string, until: string): Promise<void> {
    await deferApproval(effectiveClient, itemId, until);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  async function delegate(itemId: string, delegateTo: string): Promise<void> {
    await delegateApproval(effectiveClient, itemId, delegateTo);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  async function resume(itemId: string, mode: RecoveryMode): Promise<void> {
    await resumeWorkflow(effectiveClient, itemId, mode);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  return { items, isLoading, approve, reject, edit, patch, override, escalate, defer, delegate, resume };
}
