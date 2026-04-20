import type { ApprovalNotificationPort } from "./hitl-approval-orchestration-service.js";
import type {
  ApprovalFeedbackLink,
  ApprovalPacket,
  OapeflirStageRef,
} from "./hitl-approval-orchestration-service.js";

export type HitlNotificationChannel = "console" | "email" | "pager" | "slack";
export type HitlQueueStatus = "pending" | "acknowledged" | "resolved";

export interface HitlNotificationRoutingRule {
  channel: HitlNotificationChannel;
  minRiskLevel: ApprovalPacket["riskLevel"];
  stages?: readonly OapeflirStageRef[];
  tenantIds?: readonly string[];
}

export interface HitlQueueItem {
  queueItemId: string;
  approvalId: string;
  taskId: string;
  executionId: string | null;
  tenantId: string | null;
  title: string;
  stageRef: OapeflirStageRef;
  riskLevel: ApprovalPacket["riskLevel"];
  explanationSummary: string;
  recommendedOptionId: string | null;
  deliveryChannels: HitlNotificationChannel[];
  deliveryIds: string[];
  status: HitlQueueStatus;
  acknowledgedBy: string | null;
  takeoverSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HitlQueueFilters {
  status?: HitlQueueStatus;
  tenantId?: string | null;
  stageRef?: OapeflirStageRef;
}

export interface NotificationDispatchResult {
  channel: string;
  delivered: boolean;
  deliveryId: string | null;
}

export class HitlOperatorConsoleService implements ApprovalNotificationPort {
  private readonly queue = new Map<string, HitlQueueItem>();

  public constructor(
    private readonly routingRules: readonly HitlNotificationRoutingRule[],
    private readonly notifier: (input: {
      channel: HitlNotificationChannel;
      packet: ApprovalPacket;
    }) => Promise<{ delivered: boolean; deliveryId: string | null }>,
  ) {}

  public async dispatch(packet: ApprovalPacket): Promise<NotificationDispatchResult> {
    const channels = resolveChannels(packet, this.routingRules);
    const deliveryIds: string[] = [];
    let delivered = false;
    for (const channel of channels) {
      const result = await this.notifier({ channel, packet });
      delivered = delivered || result.delivered;
      if (result.deliveryId != null) {
        deliveryIds.push(result.deliveryId);
      }
    }
    const now = new Date().toISOString();
    this.queue.set(packet.approvalId, {
      queueItemId: `hitl_queue:${packet.approvalId}`,
      approvalId: packet.approvalId,
      taskId: packet.taskId,
      executionId: packet.executionId,
      tenantId: readTenantId(packet),
      title: packet.title,
      stageRef: packet.feedbackLink.stageRef,
      riskLevel: packet.riskLevel,
      explanationSummary: packet.explanation.summary,
      recommendedOptionId: packet.recommendedOptionId,
      deliveryChannels: channels,
      deliveryIds,
      status: "pending",
      acknowledgedBy: null,
      takeoverSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
    return {
      channel: channels.join(","),
      delivered,
      deliveryId: deliveryIds[0] ?? null,
    };
  }

  public listQueue(filters: HitlQueueFilters = {}): HitlQueueItem[] {
    return [...this.queue.values()].filter((item) => {
      if (filters.status != null && item.status !== filters.status) {
        return false;
      }
      if (filters.tenantId !== undefined && item.tenantId !== filters.tenantId) {
        return false;
      }
      if (filters.stageRef != null && item.stageRef !== filters.stageRef) {
        return false;
      }
      return true;
    });
  }

  public acknowledge(approvalId: string, operatorId: string): HitlQueueItem {
    const item = this.requireQueueItem(approvalId);
    const updated: HitlQueueItem = {
      ...item,
      status: "acknowledged",
      acknowledgedBy: operatorId,
      updatedAt: new Date().toISOString(),
    };
    this.queue.set(approvalId, updated);
    return updated;
  }

  public resolve(approvalId: string, feedbackLink: ApprovalFeedbackLink): HitlQueueItem {
    const item = this.requireQueueItem(approvalId);
    const updated: HitlQueueItem = {
      ...item,
      status: "resolved",
      updatedAt: new Date().toISOString(),
      takeoverSessionId: feedbackLink.feedbackSignalId ?? item.takeoverSessionId,
    };
    this.queue.set(approvalId, updated);
    return updated;
  }

  public attachTakeoverSession(approvalId: string, takeoverSessionId: string): HitlQueueItem {
    const item = this.requireQueueItem(approvalId);
    const updated: HitlQueueItem = {
      ...item,
      takeoverSessionId,
      updatedAt: new Date().toISOString(),
    };
    this.queue.set(approvalId, updated);
    return updated;
  }

  private requireQueueItem(approvalId: string): HitlQueueItem {
    const item = this.queue.get(approvalId);
    if (item == null) {
      throw new Error(`hitl_console.queue_item_not_found:${approvalId}`);
    }
    return item;
  }
}

function resolveChannels(
  packet: ApprovalPacket,
  rules: readonly HitlNotificationRoutingRule[],
): HitlNotificationChannel[] {
  const tenantId = readTenantId(packet);
  const channels = new Set<HitlNotificationChannel>(["console"]);
  for (const rule of rules) {
    if (compareRisk(packet.riskLevel, rule.minRiskLevel) < 0) {
      continue;
    }
    if (rule.stages != null && !rule.stages.includes(packet.feedbackLink.stageRef)) {
      continue;
    }
    if (rule.tenantIds != null && tenantId != null && !rule.tenantIds.includes(tenantId)) {
      continue;
    }
    channels.add(rule.channel);
  }
  return [...channels];
}

function readTenantId(packet: ApprovalPacket): string | null {
  const tenantId = packet.explanation.contextSnapshot.tenantId;
  return typeof tenantId === "string" && tenantId.trim().length > 0 ? tenantId : null;
}

function compareRisk(
  left: ApprovalPacket["riskLevel"],
  right: ApprovalPacket["riskLevel"],
): number {
  const weights: Record<ApprovalPacket["riskLevel"], number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return weights[left] - weights[right];
}
