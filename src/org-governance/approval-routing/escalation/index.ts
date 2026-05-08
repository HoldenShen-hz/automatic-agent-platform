import { z } from "zod";

export const ApprovalEscalationRuleSchema = z.object({
  ruleId: z.string().min(1),
  triggerAfterMinutes: z.number().int().nonnegative(),
  escalateToApproverId: z.string().min(1),
  appliesToRiskLevels: z.array(z.enum(["low", "medium", "high", "critical"])).default(["high", "critical"]),
  maxEscalationDepth: z.number().int().positive().default(1),
  cooldownMinutes: z.number().int().nonnegative().default(0),
  notifyOnSlaBreach: z.boolean().default(false),
  slaBreachNotificationTargetIds: z.array(z.string().min(1)).default([]),
});

export type ApprovalEscalationRule = z.infer<typeof ApprovalEscalationRuleSchema>;

export interface ApprovalEscalationEvaluationContext {
  readonly escalationDepth?: number;
  readonly lastEscalatedAtIso?: string | null;
  readonly slaBreached?: boolean;
}

export interface ApprovalEscalationDecision {
  readonly shouldEscalate: boolean;
  readonly shouldNotifySlaBreach: boolean;
  readonly notificationTargetIds: readonly string[];
  readonly reason:
    | "risk_not_applicable"
    | "max_depth_reached"
    | "threshold_not_reached"
    | "cooldown_active"
    | "eligible";
}

export function evaluateApprovalEscalation(
  rule: ApprovalEscalationRule,
  createdAtIso: string,
  nowIso: string,
  riskLevel: "low" | "medium" | "high" | "critical",
  context: ApprovalEscalationEvaluationContext = {},
): ApprovalEscalationDecision {
  if (!rule.appliesToRiskLevels.includes(riskLevel)) {
    return {
      shouldEscalate: false,
      shouldNotifySlaBreach: false,
      notificationTargetIds: [],
      reason: "risk_not_applicable",
    };
  }

  const escalationDepth = context.escalationDepth ?? 0;
  if (escalationDepth >= rule.maxEscalationDepth) {
    return {
      shouldEscalate: false,
      shouldNotifySlaBreach: false,
      notificationTargetIds: [],
      reason: "max_depth_reached",
    };
  }

  const elapsedMs = Date.parse(nowIso) - Date.parse(createdAtIso);
  if (elapsedMs < rule.triggerAfterMinutes * 60_000) {
    return {
      shouldEscalate: false,
      shouldNotifySlaBreach: false,
      notificationTargetIds: [],
      reason: "threshold_not_reached",
    };
  }

  if (rule.cooldownMinutes > 0 && context.lastEscalatedAtIso != null) {
    const cooldownMs = rule.cooldownMinutes * 60_000;
    const lastEscalatedMs = Date.parse(context.lastEscalatedAtIso);
    if (Number.isFinite(lastEscalatedMs) && Date.parse(nowIso) - lastEscalatedMs < cooldownMs) {
      return {
        shouldEscalate: false,
        shouldNotifySlaBreach: false,
        notificationTargetIds: [],
        reason: "cooldown_active",
      };
    }
  }

  const notificationTargetIds = context.slaBreached && rule.notifyOnSlaBreach
    ? (rule.slaBreachNotificationTargetIds.length > 0
        ? [...rule.slaBreachNotificationTargetIds]
        : [rule.escalateToApproverId])
    : [];

  return {
    shouldEscalate: true,
    shouldNotifySlaBreach: notificationTargetIds.length > 0,
    notificationTargetIds,
    reason: "eligible",
  };
}

export function shouldEscalateApproval(
  rule: ApprovalEscalationRule,
  createdAtIso: string,
  nowIso: string,
  riskLevel: "low" | "medium" | "high" | "critical",
  context: ApprovalEscalationEvaluationContext = {},
): boolean {
  return evaluateApprovalEscalation(rule, createdAtIso, nowIso, riskLevel, context).shouldEscalate;
}
