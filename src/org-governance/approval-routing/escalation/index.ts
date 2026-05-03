import { z } from "zod";

export const ApprovalEscalationRuleSchema = z.object({
  ruleId: z.string().min(1),
  triggerAfterMinutes: z.number().int().positive(),
  escalateToApproverId: z.string().min(1).optional(),
  escalateToParentManager: z.boolean().default(false),
  appliesToRiskLevels: z.array(z.enum(["low", "medium", "high", "critical"])).default(["high", "critical"]),
  escalationLevel: z.number().int().nonnegative().default(0),
});

export type ApprovalEscalationRule = z.infer<typeof ApprovalEscalationRuleSchema>;

/**
 * Approval step timeout configuration.
 * Used to enforce maximum wait time for approval at each level.
 */
export interface ApprovalStepTimeout {
  stepId: string;
  startedAtIso: string;
  maxWaitMinutes: number;
}

export const ApprovalStepTimeoutSchema = z.object({
  stepId: z.string().min(1),
  startedAtIso: z.string().datetime(),
  maxWaitMinutes: z.number().int().positive(),
});

export type ApprovalStepTimeoutConfig = z.infer<typeof ApprovalStepTimeoutSchema>;

/**
 * Check if an approval step has timed out.
 */
export function isApprovalStepTimedOut(
  timeout: ApprovalStepTimeout,
  nowIso: string,
): boolean {
  const elapsedMs = Date.parse(nowIso) - Date.parse(timeout.startedAtIso);
  return elapsedMs >= timeout.maxWaitMinutes * 60_000;
}

/**
 * Get the timeout remaining for an approval step in milliseconds.
 * Returns 0 if already timed out, or the remaining time.
 */
export function getApprovalStepTimeoutRemaining(
  timeout: ApprovalStepTimeout,
  nowIso: string,
): number {
  const elapsedMs = Date.parse(nowIso) - Date.parse(timeout.startedAtIso);
  const maxWaitMs = timeout.maxWaitMinutes * 60_000;
  return Math.max(0, maxWaitMs - elapsedMs);
}

/**
 * Multi-level escalation result containing all escalation levels.
 */
export interface EscalationChainResult {
  shouldEscalate: boolean;
  currentLevel: number;
  nextApproverId: string;
  escalatedThroughLevels: Array<{
    fromLevel: number;
    toLevel: number;
    approverId: string;
    triggeredAtIso: string;
  }>;
  timedOutStepId?: string;
}

/**
 * Evaluate a chain of escalation rules to determine multi-level escalation.
 * Processes rules in order of escalationLevel, finding all applicable escalations.
 */
export function evaluateEscalationChain(
  rules: ReadonlyArray<ApprovalEscalationRule>,
  createdAtIso: string,
  nowIso: string,
  riskLevel: "low" | "medium" | "high" | "critical",
  context: EscalationContext,
  orgNodes: ReadonlyArray<{ orgNodeId: string; parentOrgNodeId: string | null; ownerUserIds: readonly string[] }>,
): EscalationChainResult | null {
  if (rules.length === 0) {
    return null;
  }

  // Sort rules by escalation level ascending
  const sortedRules = [...rules].sort((a, b) => a.escalationLevel - b.escalationLevel);

  const escalatedThroughLevels: EscalationChainResult["escalatedThroughLevels"] = [];
  let currentApproverId = context.currentApproverId;
  let currentLevel = 0;
  let timedOutStepId: string | undefined;

  for (const rule of sortedRules) {
    // Check if rule applies to this risk level
    if (!rule.appliesToRiskLevels.includes(riskLevel)) {
      continue;
    }

    // Check if the time threshold has been met
    const elapsedMs = Date.parse(nowIso) - Date.parse(createdAtIso);
    const thresholdMs = rule.triggerAfterMinutes * 60_000;

    if (elapsedMs >= thresholdMs) {
      const newApproverId = resolveEscalationApprover(context, orgNodes, rule);

      escalatedThroughLevels.push({
        fromLevel: currentLevel,
        toLevel: rule.escalationLevel,
        approverId: newApproverId,
        triggeredAtIso: nowIso,
      });

      currentApproverId = newApproverId;
      currentLevel = rule.escalationLevel;
    }
  }

  const shouldEscalate = escalatedThroughLevels.length > 0;

  return {
    shouldEscalate,
    currentLevel,
    nextApproverId: currentApproverId,
    escalatedThroughLevels,
    ...(timedOutStepId !== undefined ? { timedOutStepId } : {}),
  };
}

export function shouldEscalateApproval(
  rule: ApprovalEscalationRule,
  createdAtIso: string,
  nowIso: string,
  riskLevel: "low" | "medium" | "high" | "critical",
): boolean {
  if (!rule.appliesToRiskLevels.includes(riskLevel)) {
    return false;
  }
  return Date.parse(nowIso) - Date.parse(createdAtIso) >= rule.triggerAfterMinutes * 60_000;
}

export interface EscalationContext {
  readonly requesterId: string;
  readonly currentApproverId: string;
  readonly orgNodeId: string;
  readonly requesterManagerIds: readonly string[];
}

export function resolveEscalationApprover(
  context: EscalationContext,
  nodes: ReadonlyArray<{ orgNodeId: string; parentOrgNodeId: string | null; ownerUserIds: readonly string[] }>,
  rule: ApprovalEscalationRule,
): string {
  // When escalateToParentManager is set, traverse the org hierarchy as primary mechanism
  // to find the next approver who can approve (not just any parent manager)
  if (rule.escalateToParentManager) {
    // Primary: Use org hierarchy traversal to find the next manager in the chain
    const escalationPath = traverseOrgHierarchyForEscalation(
      context.currentApproverId,
      context.orgNodeId,
      nodes,
    );
    if (escalationPath.length > 0) {
      return escalationPath[0]!;
    }
    // Fallback: Find parent node and return its first owner
    const currentNode = nodes.find((n) => n.orgNodeId === context.orgNodeId);
    if (currentNode?.parentOrgNodeId != null) {
      const parentNode = nodes.find((n) => n.orgNodeId === currentNode.parentOrgNodeId);
      if (parentNode?.ownerUserIds.length) {
        return parentNode.ownerUserIds[0]!;
      }
    }
    // Final fallback: use requester manager chain
    const managerChain = [...context.requesterManagerIds];
    if (managerChain.length > 0) {
      return managerChain[managerChain.length - 1] ?? context.currentApproverId;
    }
  }
  // For explicit escalateToApproverId, still traverse org hierarchy to verify the approver exists
  if (rule.escalateToApproverId != null) {
    // Verify the specified approver exists in the org hierarchy
    const escalationPath = traverseOrgHierarchyForEscalation(
      context.currentApproverId,
      context.orgNodeId,
      nodes,
    );
    // If explicit approver is found in the escalation path, use it
    if (escalationPath.includes(rule.escalateToApproverId)) {
      return rule.escalateToApproverId;
    }
    // Otherwise return the explicit approver but check if they are valid
    // (e.g., not the same as current approver)
    if (rule.escalateToApproverId !== context.currentApproverId) {
      return rule.escalateToApproverId;
    }
    // If it's the same as current, fall back to first in escalation path or current
    if (escalationPath.length > 0) {
      return escalationPath[0]!;
    }
  }
  return context.currentApproverId;
}

export function traverseOrgHierarchyForEscalation(
  approverId: string,
  orgNodeId: string,
  nodes: ReadonlyArray<{ orgNodeId: string; parentOrgNodeId: string | null; ownerUserIds: readonly string[] }>,
  maxLevels: number = 5,
): string[] {
  const escalationPath: string[] = [];
  let currentNode = nodes.find((n) => n.orgNodeId === orgNodeId);
  let levelsTraversed = 0;
  while (currentNode != null && levelsTraversed < maxLevels) {
    const parentNode = currentNode.parentOrgNodeId != null
      ? nodes.find((n) => n.orgNodeId === currentNode!.parentOrgNodeId)
      : null;
    if (parentNode?.ownerUserIds.length) {
      const nextApprover = parentNode.ownerUserIds[0] ?? "";
      if (nextApprover && !escalationPath.includes(nextApprover) && nextApprover !== approverId) {
        escalationPath.push(nextApprover);
      }
    }
    if (parentNode == null) break;
    currentNode = parentNode;
    levelsTraversed++;
  }
  return escalationPath;
}
