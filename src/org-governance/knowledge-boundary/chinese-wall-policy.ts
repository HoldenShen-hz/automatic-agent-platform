export interface ChineseWallPolicy {
  readonly policyId: string;
  readonly conflictGroups: Readonly<Record<string, readonly string[]>>;
}

export interface ChineseWallDecision {
  readonly allowed: boolean;
  readonly blockedGroupId: string | null;
  readonly reasonCodes: readonly string[];
}

export function evaluateChineseWallPolicy(
  policy: ChineseWallPolicy,
  requesterOrgNodeId: string,
  targetOrgNodeId: string,
): ChineseWallDecision {
  for (const [groupId, orgNodeIds] of Object.entries(policy.conflictGroups)) {
    if (orgNodeIds.includes(requesterOrgNodeId) && orgNodeIds.includes(targetOrgNodeId) && requesterOrgNodeId !== targetOrgNodeId) {
      return {
        allowed: false,
        blockedGroupId: groupId,
        reasonCodes: ["knowledge_boundary.chinese_wall_blocked", `knowledge_boundary.conflict_group:${groupId}`],
      };
    }
  }
  return {
    allowed: true,
    blockedGroupId: null,
    reasonCodes: ["knowledge_boundary.chinese_wall_clear"],
  };
}
