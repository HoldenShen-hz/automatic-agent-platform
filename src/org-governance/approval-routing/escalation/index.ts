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

export interface ApprovalEscalationRule {
  readonly ruleId: string;
  readonly triggerAfterMinutes: number;
  readonly escalateToApproverId: string;
  readonly appliesToRiskLevels: readonly ("low" | "medium" | "high" | "critical")[];
  readonly maxEscalationDepth?: number;
  readonly cooldownMinutes?: number;
  readonly notifyOnSlaBreach?: boolean;
  readonly slaBreachNotificationTargetIds?: readonly string[];
}

export interface ApprovalEscalationEvaluationContext {
  readonly escalationDepth?: number;
  readonly lastEscalatedAtIso?: string | null;
  readonly slaBreached?: boolean;
  // R5-36: OrgTree for hierarchy traversal
  readonly orgNodeId?: string;
  readonly orgNodes?: ReadonlyArray<{ orgNodeId: string; parentOrgNodeId: string | null; ownerUserIds: readonly string[] }>;
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

/**
 * R5-36: Traverse OrgTree hierarchy to find the next approver
 * Walks up the management chain from the current org node to find a parent approver
 */
export function traverseOrgHierarchy(
  currentOrgNodeId: string,
  orgNodes: ReadonlyArray<{ orgNodeId: string; parentOrgNodeId: string | null; ownerUserIds: readonly string[] }>,
  maxDepth: number = 3,
): string | null {
  let currentNodeId: string | null = currentOrgNodeId;
  let depth = 0;

  while (currentNodeId != null && depth < maxDepth) {
    const currentNode = orgNodes.find((n) => n.orgNodeId === currentNodeId);
    if (!currentNode) {
      break;
    }

    // If current node has owners, return the first one as the escalation target
    if (currentNode.ownerUserIds.length > 0) {
      return currentNode.ownerUserIds[0] ?? null;
    }

    // Move to parent
    currentNodeId = currentNode.parentOrgNodeId;
    depth++;
  }

  return null;
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
  if (escalationDepth >= (rule.maxEscalationDepth ?? 1)) {
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

  if ((rule.cooldownMinutes ?? 0) > 0 && context.lastEscalatedAtIso != null) {
    const cooldownMs = (rule.cooldownMinutes ?? 0) * 60_000;
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

  // R5-36: Resolve escalation target via hierarchy traversal if orgNodes provided
  const escalationTarget = context.orgNodes != null && context.orgNodeId != null
    ? traverseOrgHierarchy(context.orgNodeId, context.orgNodes, rule.maxEscalationDepth ?? 1)
    : rule.escalateToApproverId;

  const notificationTargetIds: string[] = context.slaBreached && rule.notifyOnSlaBreach === true
    ? ((rule.slaBreachNotificationTargetIds?.length ?? 0) > 0
        ? [...(rule.slaBreachNotificationTargetIds ?? [])]
        : escalationTarget != null ? [escalationTarget as string] : [])
    : [];

  return {
    shouldEscalate: true,
    shouldNotifySlaBreach: notificationTargetIds.length > 0,
    notificationTargetIds: notificationTargetIds.filter((targetId): targetId is string => targetId != null),
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
