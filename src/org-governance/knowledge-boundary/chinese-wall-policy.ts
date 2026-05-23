export interface ChineseWallPolicy {
  readonly policyId: string;
  readonly conflictGroups?: Readonly<Record<string, readonly string[]>>;
  readonly blockedOrgNodeIds?: readonly string[];
  readonly wallExpiryPolicy?: "never" | "expires_at";
  readonly expiresAt?: string | null;
  readonly resetRequiresApprovalRole?: "compliance_officer";
  readonly coolDownUntil?: string | null;
  readonly residualScanRequired?: boolean;
}

export interface ChineseWallConstraint {
  readonly constraintId: string;
  readonly policyId: string;
  readonly requesterOrgNodeId: string;
  readonly targetOrgNodeId: string;
  readonly blockedGroupId: string | null;
  readonly reasonCodes: readonly string[];
}

export interface ChineseWallDecision {
  readonly allowed: boolean;
  readonly blockedGroupId: string | null;
  readonly reasonCodes: readonly string[];
  readonly constraint: ChineseWallConstraint | null;
}

export function evaluateChineseWallPolicy(
  policy: ChineseWallPolicy,
  requesterOrgNodeId: string,
  targetOrgNodeId: string,
  resetContext?: {
    readonly approvedByRole?: "compliance_officer";
    readonly residualScanCompleted?: boolean;
    readonly nowIso?: string;
  },
): ChineseWallDecision {
  if (policy.wallExpiryPolicy === "expires_at" && policy.expiresAt != null) {
    const nowIso = resetContext?.nowIso ?? new Date().toISOString();
    if (Date.parse(nowIso) >= Date.parse(policy.expiresAt)) {
      if (policy.resetRequiresApprovalRole === "compliance_officer"
        && resetContext?.approvedByRole !== "compliance_officer") {
        return {
          allowed: false,
          blockedGroupId: "reset_requires_compliance_officer",
          reasonCodes: ["knowledge_boundary.chinese_wall_reset_requires_compliance_officer"],
          constraint: buildChineseWallConstraint(policy, requesterOrgNodeId, targetOrgNodeId, "reset_requires_compliance_officer", [
            "knowledge_boundary.chinese_wall_reset_requires_compliance_officer",
          ]),
        };
      }
      if (policy.coolDownUntil != null && Date.parse(nowIso) < Date.parse(policy.coolDownUntil)) {
        return {
          allowed: false,
          blockedGroupId: "cool_down_active",
          reasonCodes: ["knowledge_boundary.chinese_wall_cool_down_active"],
          constraint: buildChineseWallConstraint(policy, requesterOrgNodeId, targetOrgNodeId, "cool_down_active", [
            "knowledge_boundary.chinese_wall_cool_down_active",
          ]),
        };
      }
      if (policy.residualScanRequired && resetContext?.residualScanCompleted !== true) {
        return {
          allowed: false,
          blockedGroupId: "residual_scan_required",
          reasonCodes: ["knowledge_boundary.chinese_wall_residual_scan_required"],
          constraint: buildChineseWallConstraint(policy, requesterOrgNodeId, targetOrgNodeId, "residual_scan_required", [
            "knowledge_boundary.chinese_wall_residual_scan_required",
          ]),
        };
      }
      return {
        allowed: true,
        blockedGroupId: null,
        reasonCodes: ["knowledge_boundary.chinese_wall_expired_and_reset"],
        constraint: null,
      };
    }
  }

  if ((policy.blockedOrgNodeIds ?? []).includes(requesterOrgNodeId) && requesterOrgNodeId !== targetOrgNodeId) {
    return {
      allowed: false,
      blockedGroupId: "blocked_org_node",
      reasonCodes: ["knowledge_boundary.chinese_wall_blocked", "knowledge_boundary.blocked_org_node"],
      constraint: buildChineseWallConstraint(policy, requesterOrgNodeId, targetOrgNodeId, "blocked_org_node", [
        "knowledge_boundary.chinese_wall_blocked",
        "knowledge_boundary.blocked_org_node",
      ]),
    };
  }

  for (const [groupId, orgNodeIds] of Object.entries(policy.conflictGroups ?? {})) {
    if (orgNodeIds.includes(requesterOrgNodeId) && orgNodeIds.includes(targetOrgNodeId) && requesterOrgNodeId !== targetOrgNodeId) {
      return {
        allowed: false,
        blockedGroupId: groupId,
        reasonCodes: ["knowledge_boundary.chinese_wall_blocked", `knowledge_boundary.conflict_group:${groupId}`],
        constraint: buildChineseWallConstraint(policy, requesterOrgNodeId, targetOrgNodeId, groupId, [
          "knowledge_boundary.chinese_wall_blocked",
          `knowledge_boundary.conflict_group:${groupId}`,
        ]),
      };
    }
  }
  return {
    allowed: true,
    blockedGroupId: null,
    reasonCodes: ["knowledge_boundary.chinese_wall_clear"],
    constraint: null,
  };
}

function buildChineseWallConstraint(
  policy: ChineseWallPolicy,
  requesterOrgNodeId: string,
  targetOrgNodeId: string,
  blockedGroupId: string | null,
  reasonCodes: readonly string[],
): ChineseWallConstraint {
  return {
    constraintId: `${policy.policyId}:${requesterOrgNodeId}:${targetOrgNodeId}:${blockedGroupId ?? "clear"}`,
    policyId: policy.policyId,
    requesterOrgNodeId,
    targetOrgNodeId,
    blockedGroupId,
    reasonCodes,
  };
}
