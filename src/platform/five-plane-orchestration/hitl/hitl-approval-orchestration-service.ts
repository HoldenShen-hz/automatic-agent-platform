import {
  ApprovalService,
  type ApprovalDecision,
  type ApprovalRequest,
} from "../../five-plane-control-plane/approval-center/approval-service.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { HITLExplainabilityService, type DecisionExplanation } from "./hitl-explainability-service.js";
import { validateHitlModeRequest, type HitlMode } from "./hitl-modes.js";

export type OapeflirStageRef =
  | "observe"
  | "assess"
  | "plan"
  | "execute"
  | "feedback"
  | "learn"
  | "improve"
  | "release";

export type ApprovalDecisionEffect =
  | "continue"
  | "revise_plan"
  | "block_candidate"
  | "approve_candidate"
  | "advance_rollout"
  | "rollback_rollout";

export interface ApprovalFeedbackLink {
  readonly approvalId: string;
  readonly taskId: string;
  readonly stageRef: OapeflirStageRef;
  readonly loopIteration: number | null;
  readonly refId: string | null;
  readonly feedbackSignalId: string | null;
  readonly decisionEffect: ApprovalDecisionEffect;
  readonly loop_iteration?: number | null;
  readonly ref_id?: string | null;
  readonly feedback_signal_id?: string | null;
}

export interface ApprovalPacketOption {
  readonly optionId: string;
  readonly label: string;
  readonly style: "primary" | "danger" | "secondary";
  readonly requiresConfirm: boolean;
}

export interface ApprovalPacket {
  readonly approvalId: string;
  readonly taskId: string;
  readonly executionId: string | null;
  readonly mode: HitlMode;
  readonly title: string;
  readonly reason: string;
  readonly riskLevel: ApprovalRequest["riskLevel"];
  readonly options: readonly ApprovalPacketOption[];
  readonly recommendedOptionId: string | null;
  readonly deadlineAt: string | null;
  readonly timeoutPolicy: ApprovalRequest["timeoutPolicy"];
  readonly explanation: DecisionExplanation;
  readonly feedbackLink: ApprovalFeedbackLink;
}

export interface ApprovalNotificationPort {
  dispatch(packet: ApprovalPacket): Promise<{ channel: string; delivered: boolean; deliveryId: string | null }>;
}

export interface HitlApprovalRequest {
  readonly taskId: string;
  readonly executionId?: string | null;
  readonly sourceAgentId: string;
  readonly mode?: HitlMode;
  readonly title: string;
  readonly reason: string;
  readonly riskLevel: ApprovalRequest["riskLevel"];
  readonly stageRef: OapeflirStageRef;
  readonly loopIteration?: number | null;
  readonly refId?: string | null;
  readonly context?: Record<string, unknown>;
  readonly options: readonly ApprovalPacketOption[];
  readonly recommendedOptionId?: string | null;
  readonly deadlineAt?: string | null;
  readonly timeoutPolicy: ApprovalRequest["timeoutPolicy"];
  readonly breakGlassApproved?: boolean;
}

export interface HitlApprovalDecisionResult {
  readonly approvalId: string;
  readonly decision: ApprovalDecision;
  readonly feedbackLink: ApprovalFeedbackLink;
}

function defaultEffectForDecision(decision: ApprovalDecision): ApprovalDecisionEffect {
  if (decision.decisionType === "rejected" || decision.decisionType === "expired") {
    return "block_candidate";
  }
  if (decision.decisionType === "text_input") {
    return "revise_plan";
  }
  if (decision.selectedOptionId === "rollback") {
    return "rollback_rollout";
  }
  if (decision.selectedOptionId === "advance_rollout") {
    return "advance_rollout";
  }
  if (decision.selectedOptionId === "approve_candidate") {
    return "approve_candidate";
  }
  return "continue";
}

export class HitlApprovalOrchestrationService {
  private readonly packets = new Map<string, ApprovalPacket>();
  private readonly feedbackLinks = new Map<string, ApprovalFeedbackLink>();

  public constructor(
    private readonly approvalService: ApprovalService,
    private readonly explainabilityService: HITLExplainabilityService,
    private readonly notificationPort: ApprovalNotificationPort | null = null,
  ) {}

  public async requestApproval(request: HitlApprovalRequest): Promise<ApprovalPacket> {
    const mode = request.mode ?? "single_approval";
    if (request.options.length === 0) {
      throw new Error("hitl_approval.options_required");
    }
    if (request.riskLevel === "critical" && request.timeoutPolicy === "approve" && request.breakGlassApproved !== true) {
      throw new Error("hitl_approval.critical_timeout_auto_approve_forbidden");
    }
    const modeConstraint = validateHitlModeRequest({
      mode,
      options: request.options,
      riskLevel: request.riskLevel,
      timeoutPolicy: request.timeoutPolicy,
      context: {
        ...(request.context ?? {}),
        breakGlassApproved: request.breakGlassApproved ?? false,
      },
    });

    const approval = this.approvalService.createRequest({
      taskId: request.taskId,
      executionId: request.executionId ?? null,
      sourceAgentId: request.sourceAgentId,
      reason: request.reason,
      riskLevel: request.riskLevel,
      options: request.options.map((option) => option.optionId),
      context: {
        ...(request.context ?? {}),
        title: request.title,
        stageRef: request.stageRef,
        loopIteration: request.loopIteration ?? null,
        refId: request.refId ?? null,
        recommendedOptionId: request.recommendedOptionId ?? null,
        deadlineAt: request.deadlineAt ?? null,
        hitlMode: mode,
        hitlModeSummary: modeConstraint.summary,
      },
      timeoutPolicy: request.timeoutPolicy,
    });

    const explanation = this.explainabilityService.explainApprovalRequired(
      request.taskId,
      {
        riskLevel: request.riskLevel,
        policy: "approval_and_hitl_contract",
        classification: String(request.context?.classification ?? "unspecified"),
      },
      {
        executionId: request.executionId ?? null,
        contextSnapshot: {
          ...(request.context ?? {}),
          taskId: request.taskId,
          executionId: request.executionId ?? null,
          title: request.title,
          stageRef: request.stageRef,
          recommendedOptionId: request.recommendedOptionId ?? null,
          hitlMode: mode,
        },
      },
    );
    const feedbackLink: ApprovalFeedbackLink = {
      approvalId: approval.approvalId,
      taskId: request.taskId,
      stageRef: request.stageRef,
      loopIteration: request.loopIteration ?? null,
      refId: request.refId ?? null,
      feedbackSignalId: null,
      decisionEffect: "continue",
      loop_iteration: request.loopIteration ?? null,
      ref_id: request.refId ?? null,
      feedback_signal_id: null,
    };
    const packet: ApprovalPacket = {
      approvalId: approval.approvalId,
      taskId: request.taskId,
      executionId: request.executionId ?? null,
      mode,
      title: request.title,
      reason: request.reason,
      riskLevel: request.riskLevel,
      options: request.options,
      recommendedOptionId: request.recommendedOptionId ?? null,
      deadlineAt: request.deadlineAt ?? null,
      timeoutPolicy: request.timeoutPolicy,
      explanation,
      feedbackLink,
    };

    this.packets.set(packet.approvalId, packet);
    this.feedbackLinks.set(packet.approvalId, feedbackLink);
    if (this.notificationPort != null) {
      await this.notificationPort.dispatch(packet);
    }
    return packet;
  }

  public applyDecision(decision: ApprovalDecision): HitlApprovalDecisionResult {
    const existingLink = this.feedbackLinks.get(decision.approvalId);
    if (existingLink == null) {
      throw new Error(`hitl_approval.feedback_link_not_found:${decision.approvalId}`);
    }
    this.approvalService.applyDecision(decision);
    const feedbackSignalId = existingLink.feedbackSignalId
      ?? (decision.decisionType === "expired" ? null : newId("feedback_signal"));
    const updatedLink: ApprovalFeedbackLink = {
      ...existingLink,
      feedbackSignalId,
      decisionEffect: defaultEffectForDecision(decision),
      feedback_signal_id: feedbackSignalId,
    };
    this.feedbackLinks.set(decision.approvalId, updatedLink);
    return {
      approvalId: decision.approvalId,
      decision,
      feedbackLink: updatedLink,
    };
  }

  public buildTimeoutDecision(approvalId: string, respondedBy = "system:hitl_timeout"): ApprovalDecision {
    const packet = this.packets.get(approvalId);
    if (packet == null) {
      throw new Error(`hitl_approval.packet_not_found:${approvalId}`);
    }
    if (packet.timeoutPolicy === "approve") {
      return {
        approvalId,
        decisionType: "confirmed",
        confirmed: true,
        respondedBy,
        respondedAt: nowIso(),
      };
    }
    return {
      approvalId,
      decisionType: "expired",
      respondedBy,
      respondedAt: nowIso(),
    };
  }

  public getPacket(approvalId: string): ApprovalPacket | null {
    return this.packets.get(approvalId) ?? null;
  }

  public listPackets(): ApprovalPacket[] {
    return [...this.packets.values()];
  }

  public getFeedbackLink(approvalId: string): ApprovalFeedbackLink | null {
    return this.feedbackLinks.get(approvalId) ?? null;
  }

  public listFeedbackLinks(): ApprovalFeedbackLink[] {
    return [...this.feedbackLinks.values()];
  }
}
