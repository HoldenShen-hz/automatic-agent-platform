import type {
  ApprovalFeedbackLink,
  ApprovalPacket,
  ApprovalPacketOption,
} from "./hitl-approval-orchestration-service.js";
import type { HitlMode } from "./hitl-modes.js";

export type HitlNotificationChannel = "console" | "email" | "slack" | "webhook" | "mobile_push";
export type HitlInboxStatus = "pending" | "due_soon" | "expired" | "decided";

export interface HitlInboxItem {
  readonly itemId: string;
  readonly approvalId: string;
  readonly taskId: string;
  readonly executionId: string | null;
  readonly mode: HitlMode;
  readonly title: string;
  readonly reason: string;
  readonly riskLevel: ApprovalPacket["riskLevel"];
  readonly stageRef: ApprovalFeedbackLink["stageRef"];
  readonly status: HitlInboxStatus;
  readonly deadlineAt: string | null;
  readonly timeoutPolicy: ApprovalPacket["timeoutPolicy"];
  readonly recommendedOptionId: string | null;
  readonly availableActions: readonly ApprovalPacketOption[];
  readonly notificationChannels: readonly HitlNotificationChannel[];
  readonly explanationSummary: string;
}

export interface HitlInboxSummary {
  readonly total: number;
  readonly pending: number;
  readonly dueSoon: number;
  readonly expired: number;
  readonly decided: number;
  readonly critical: number;
}

export class HitlInboxService {
  public buildInbox(
    packets: readonly ApprovalPacket[],
    feedbackLinks: readonly ApprovalFeedbackLink[] = [],
    now: string = new Date().toISOString(),
  ): HitlInboxItem[] {
    const feedbackByApprovalId = new Map(feedbackLinks.map((link) => [link.approvalId, link]));
    return packets
      .map((packet) => this.toInboxItem(packet, feedbackByApprovalId.get(packet.approvalId) ?? null, now))
      .sort((left, right) => {
        return compareStatus(left.status, right.status)
          || compareRisk(left.riskLevel, right.riskLevel)
          || compareNullableIso(left.deadlineAt, right.deadlineAt)
          || left.approvalId.localeCompare(right.approvalId);
      });
  }

  public buildSummary(items: readonly HitlInboxItem[]): HitlInboxSummary {
    return {
      total: items.length,
      pending: items.filter((item) => item.status === "pending").length,
      dueSoon: items.filter((item) => item.status === "due_soon").length,
      expired: items.filter((item) => item.status === "expired").length,
      decided: items.filter((item) => item.status === "decided").length,
      critical: items.filter((item) => item.riskLevel === "critical").length,
    };
  }

  private toInboxItem(
    packet: ApprovalPacket,
    feedbackLink: ApprovalFeedbackLink | null,
    now: string,
  ): HitlInboxItem {
    return {
      itemId: `hitl_inbox:${packet.approvalId}`,
      approvalId: packet.approvalId,
      taskId: packet.taskId,
      executionId: packet.executionId,
      mode: packet.mode,
      title: packet.title,
      reason: packet.reason,
      riskLevel: packet.riskLevel,
      stageRef: packet.feedbackLink.stageRef,
      status: resolveStatus(packet.deadlineAt, feedbackLink, now),
      deadlineAt: packet.deadlineAt,
      timeoutPolicy: packet.timeoutPolicy,
      recommendedOptionId: packet.recommendedOptionId,
      availableActions: packet.options,
      notificationChannels: defaultNotificationChannels(packet.riskLevel, packet.mode),
      explanationSummary: packet.explanation.summary,
    };
  }
}

function resolveStatus(
  deadlineAt: string | null,
  feedbackLink: ApprovalFeedbackLink | null,
  now: string,
): HitlInboxStatus {
  if (feedbackLink?.feedbackSignalId != null || (feedbackLink != null && feedbackLink.decisionEffect !== "continue")) {
    return "decided";
  }
  if (deadlineAt == null) {
    return "pending";
  }
  if (deadlineAt <= now) {
    return "expired";
  }
  const remainingMs = Date.parse(deadlineAt) - Date.parse(now);
  if (Number.isFinite(remainingMs) && remainingMs <= 15 * 60 * 1000) {
    return "due_soon";
  }
  return "pending";
}

function defaultNotificationChannels(
  riskLevel: ApprovalPacket["riskLevel"],
  mode: HitlMode,
): readonly HitlNotificationChannel[] {
  if (mode === "circuit_breaker_human") {
    return ["console", "slack", "mobile_push", "webhook"];
  }
  if (mode === "delegated_approval") {
    return ["console", "email", "slack"];
  }
  if (riskLevel === "critical") {
    return ["console", "slack", "mobile_push"];
  }
  if (riskLevel === "high") {
    return ["console", "slack"];
  }
  return ["console"];
}

function compareStatus(left: HitlInboxStatus, right: HitlInboxStatus): number {
  const order: Record<HitlInboxStatus, number> = {
    expired: 0,
    due_soon: 1,
    pending: 2,
    decided: 3,
  };
  return order[left] - order[right];
}

function compareRisk(left: ApprovalPacket["riskLevel"], right: ApprovalPacket["riskLevel"]): number {
  const order: Record<ApprovalPacket["riskLevel"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return order[left] - order[right];
}

function compareNullableIso(left: string | null, right: string | null): number {
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }
  return left.localeCompare(right);
}
