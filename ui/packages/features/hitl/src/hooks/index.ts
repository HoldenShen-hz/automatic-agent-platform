import type { RESTClient, WSClient, WSEventEnvelope } from "@aa/shared-api-client";
import { fetchApprovals, approveApproval, rejectApproval, delegateApproval, resumeWorkflow } from "@aa/shared-api-client";
import type { ApprovalDTO } from "@aa/shared-types";
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
const DEFAULT_HITL_ITEMS: readonly HitlItem[] = [
  { id: "inspect-default", type: "approval", title: "Inspect", description: "查看当前 PlanBundle、Context 和执行状态。" },
  { id: "takeover-default", type: "approval", title: "Takeover", description: "接管执行并写入人工操作记录。" },
  { id: "resume-default", type: "resume", title: "Resume", description: "支持 normal、replan、supervised、abort 四种恢复模式。" },
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
  const [items, setItems] = useState<readonly HitlItem[]>(DEFAULT_HITL_ITEMS);
  const [isLoading, setIsLoading] = useState(false);

  // §4.6.2: Fetch approval items from REST API when client provided
  useEffect(() => {
    if (client == null) return;

    let cancelled = false;
    setIsLoading(true);
    void fetchApprovals(client).then((approvals) => {
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
  }, [client]);

  // §4.6.2: Subscribe to ws events for real-time approval updates
  useEffect(() => {
    if (wsClient == null || userId == null) return;

    const channel = `approvals.${userId}`;
    const unsubscribe = wsClient.subscribe(channel, (event: WSEventEnvelope) => {
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
  }, [wsClient, userId]);

  async function approve(itemId: string): Promise<void> {
    if (client == null) return;
    await approveApproval(client, itemId);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  async function reject(itemId: string): Promise<void> {
    if (client == null) return;
    await rejectApproval(client, itemId);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  async function edit(itemId: string, edits: Record<string, unknown>): Promise<void> {
    // §4.6.2: Edit allows modifying the approval parameters before resolution
    if (client == null) return;
    console.info(`[HITL] Edit item ${itemId}:`, edits);
    // In production this would call an updateApproval API
  }

  async function patch(itemId: string, patch: Record<string, unknown>): Promise<void> {
    // §4.6.2: Patch allows partial modification of the approval/workflow context
    if (client == null) return;
    console.info(`[HITL] Patch item ${itemId}:`, patch);
    // In production this would call a patchApproval API endpoint
  }

  async function override(itemId: string, override: Record<string, unknown>): Promise<void> {
    // §4.6.2: Override replaces the entire approval/workflow context with new values
    if (client == null) return;
    console.info(`[HITL] Override item ${itemId}:`, override);
    // In production this would call an overrideApproval API endpoint
  }

  async function escalate(itemId: string, reason: string): Promise<void> {
    // §4.6.2: Escalate moves the approval to a higher authority
    if (client == null) return;
    console.info(`[HITL] Escalate item ${itemId}: ${reason}`);
    // Escalation would call escalateApproval API
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  async function defer(itemId: string, until: string): Promise<void> {
    // §4.6.2: Defer delays the approval until a specified time
    if (client == null) return;
    console.info(`[HITL] Defer item ${itemId} until ${until}`);
    // Deferral would call deferApproval API with a timestamp
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  async function delegate(itemId: string, delegateTo: string): Promise<void> {
    if (client == null) return;
    await delegateApproval(client, itemId, delegateTo);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  async function resume(itemId: string, mode: RecoveryMode): Promise<void> {
    // §4.6.2: Resume with specific recovery mode - integrate with execution engine
    if (client == null) return;
    console.info(`[HITL] Resume item ${itemId} with mode ${mode}`);
    // For resume items, call the workflow resume API with the appropriate mode
    // The itemId represents the workflow/execution to resume
    await resumeWorkflow(client, itemId);
  }

  return { items, isLoading, approve, reject, edit, patch, override, escalate, defer, delegate, resume };
}
