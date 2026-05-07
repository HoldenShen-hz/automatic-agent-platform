import { nowIso } from "../../contracts/types/ids.js";
import { type PanicActivationRequest, type PanicResumeReceipt, PlatformPanicService } from "../../../ops-maturity/emergency/platform-panic-service.js";
import type { ResumePlan } from "../../../ops-maturity/emergency/resume-protocol/index.js";
import type { ApprovalService } from "../../five-plane-control-plane/approval-center/approval-service.js";

export type EscalationRiskLevel = "low" | "medium" | "high" | "critical";
export type EscalationDecisionType = "none" | "approval" | "takeover" | "panic_stop";
export type EscalationStage = "assess" | "plan" | "execute" | "feedback" | "improve" | "release";

/** Default cost threshold per §12 policy-driven cost escalation */
const DEFAULT_COST_THRESHOLD_USD = 10;

export interface EscalationRequest {
  taskId: string;
  executionId: string | null;
  tenantId: string | null;
  stage: EscalationStage;
  riskLevel: EscalationRiskLevel;
  reasonCode: string;
  estimatedCostUsd: number | null;
  affectsProduction: boolean;
  /**
   * Policy-driven cost threshold for escalation (per §12).
   * When estimatedCostUsd >= costThresholdUsd, approval is required.
   * Uses DEFAULT_COST_THRESHOLD_USD if not provided.
   */
  costThresholdUsd?: number;
}

export interface EscalationDecision {
  decision: EscalationDecisionType;
  reasonCode: string;
  requiresOperatorAction: boolean;
  panicDirectiveId?: string;
  /** Approval request ID created when decision is "approval" (R17-10) */
  approvalRequestId?: string;
}

export class EscalationService {
  private readonly panicService: PlatformPanicService;
  private readonly approvalService: ApprovalService | null;

  public constructor(panicService?: PlatformPanicService, approvalService?: ApprovalService | null) {
    this.panicService = panicService ?? new PlatformPanicService();
    this.approvalService = approvalService ?? null;
  }

  /**
   * Determines escalation action and performs necessary side effects.
   *
   * R17-10: When decision is "approval", this method actually creates an
   * ApprovalRequest via ApprovalService and returns the approvalRequestId.
   *
   * R17-19: Cost threshold is policy-driven via costThresholdUsd in request.
   *
   * §186-2177: Implements layered escalation hierarchy:
   * - Tier 1 (agent): Automated resolution attempted first
   * - Tier 2 (team): Escalation to team-level review for high-risk or cost threshold
   * - Tier 3 (human): Human takeover required for critical execute-stage failures
   * - Tier 4 (incident): Full panic/cascade-halt for production-critical failures
   *
   * The escalation follows a strict priority order - higher tiers short-circuit lower ones.
   */
  public decide(input: EscalationRequest): EscalationDecision {
    const needsHumanTakeover = input.riskLevel === "critical" || (input.riskLevel === "high" && input.stage === "execute");
    const needsIncidentPanic = input.riskLevel === "critical" && input.affectsProduction;

    // Tier 3 (human): Human takeover for critical risks or high-risk execute-stage failures
    // Tier 4 (incident): Panic stop takes precedence over human takeover for critical production
    if (needsIncidentPanic) {
      return this.triggerPanicStop(input);
    }
    if (needsHumanTakeover) {
      return {
        decision: "takeover",
        reasonCode: "escalation.human_takeover_required",
        requiresOperatorAction: true,
      };
    }

    // Tier 2 (team): Team-level approval for production impact, policy cost threshold, or high risk.
    const costThreshold = input.costThresholdUsd ?? DEFAULT_COST_THRESHOLD_USD;
    const needsTeamApproval = input.affectsProduction
      || (input.estimatedCostUsd ?? 0) >= costThreshold
      || input.riskLevel === "high";
    if (!needsTeamApproval) {
      return {
        decision: "none",
        reasonCode: "escalation.not_required",
        requiresOperatorAction: false,
      };
    }

    // Tier 2 (team): Team-level approval for production impact, cost threshold, or high risk
    // R17-10: Actually create the approval request instead of just returning a structure
    const approvalRequestId = this.createApprovalRequest(input);
    return {
      decision: "approval",
      reasonCode: "escalation.approval_required",
      requiresOperatorAction: true,
      ...(approvalRequestId != null ? { approvalRequestId } : {}),
    };
  }

  /**
   * Creates an approval request via ApprovalService when escalation requires human approval.
   * Returns the approvalRequestId if created, undefined otherwise.
   */
  private createApprovalRequest(input: EscalationRequest): string | undefined {
    if (!this.approvalService) {
      return undefined;
    }
    try {
      const approval = this.approvalService.createRequest({
        taskId: input.taskId,
        executionId: input.executionId,
        sourceAgentId: "escalation-service",
        reason: `Escalation: ${input.reasonCode}`,
        riskLevel: input.riskLevel,
        options: ["approve", "reject"],
        context: {
          tenantId: input.tenantId,
          escalationStage: input.stage,
          estimatedCostUsd: input.estimatedCostUsd,
          affectsProduction: input.affectsProduction,
        },
        timeoutPolicy: "reject",
      });
      return approval.approvalId;
    } catch {
      return undefined;
    }
  }

  /**
   * Triggers platform panic with cascade halt and panic acknowledgment protocol.
   * Requires dual-admin PlatformResumeDirective for recovery (per §60).
   */
  public triggerPanicStop(input: EscalationRequest): EscalationDecision {
    const scope = this.buildPanicScope(input);
    const request: PanicActivationRequest = {
      scope,
      reasonCode: input.reasonCode,
      activeIncidents: 1,
      issuedBy: input.tenantId ?? "system",
      issuedAt: nowIso(),
      freezeModes: ["deploy", "approval", "write", "automation"],
      requiredApprovers: this.buildRequiredApprovers(input),
      severity: "full",
      triggerSignals: [input.stage, input.riskLevel],
    };

    const activation = this.panicService.activate(request);
    return {
      decision: "panic_stop",
      reasonCode: `panic.cascade_halt:${input.reasonCode}`,
      requiresOperatorAction: true,
      panicDirectiveId: activation.directive.directiveId,
    };
  }

  /**
   * Resumes from panic mode with dual-admin verification (per §60).
   */
  public resumeFromPanic(scope: string, plan: ResumePlan): PanicResumeReceipt {
    return this.panicService.resume(scope, plan);
  }

  /**
   * Gets active panic state for a scope.
   */
  public getActivePanic(scope: string) {
    return this.panicService.getActive(scope);
  }

  private buildPanicScope(input: EscalationRequest): string {
    if (input.tenantId) {
      return `tenant/${input.tenantId}`;
    }
    return "platform";
  }

  private buildRequiredApprovers(input: EscalationRequest): readonly [string, string] {
    const primary = input.tenantId?.trim() || "system";
    const secondary = primary === "platform_admin" ? "security_admin" : "platform_admin";
    return [primary, secondary];
  }
}
