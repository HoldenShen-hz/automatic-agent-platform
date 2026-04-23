export function evaluateChineseWallPolicy(policy, requesterOrgNodeId, targetOrgNodeId) {
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
//# sourceMappingURL=chinese-wall-policy.js.map