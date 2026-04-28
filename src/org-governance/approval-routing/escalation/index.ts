import { z } from "zod";

export const ApprovalEscalationRuleSchema = z.object({
  ruleId: z.string().min(1),
  triggerAfterMinutes: z.number().int().positive(),
  escalateToApproverId: z.string().min(1).optional(),
  escalateToParentManager: z.boolean().default(false),
  appliesToRiskLevels: z.array(z.enum(["low", "medium", "high", "critical"])).default(["high", "critical"]),
});

export type ApprovalEscalationRule = z.infer<typeof ApprovalEscalationRuleSchema>;

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
  if (rule.escalateToApproverId != null) {
    return rule.escalateToApproverId;
  }
  if (rule.escalateToParentManager) {
    const escalationPath = traverseOrgHierarchyForEscalation(
      context.currentApproverId,
      context.orgNodeId,
      nodes,
    );
    if (escalationPath.length > 0) {
      return escalationPath[0];
    }
    const currentNode = nodes.find((n) => n.orgNodeId === context.orgNodeId);
    if (currentNode?.parentOrgNodeId != null) {
      const parentNode = nodes.find((n) => n.orgNodeId === currentNode.parentOrgNodeId);
      if (parentNode?.ownerUserIds.length) {
        return parentNode.ownerUserIds[0] ?? context.currentApproverId;
      }
    }
    const managerChain = [...context.requesterManagerIds];
    if (managerChain.length > 0) {
      return managerChain[managerChain.length - 1] ?? context.currentApproverId;
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
