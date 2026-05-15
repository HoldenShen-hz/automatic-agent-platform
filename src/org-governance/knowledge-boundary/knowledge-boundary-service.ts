import { nowIso } from "../../platform/contracts/types/ids.js";
import {
  redactKnowledgeAccessLog,
  type KnowledgeAccessLogRecord,
} from "./access-log/index.js";
import {
  canAccessKnowledgeBoundary,
  type KnowledgeBoundary,
} from "./boundary-manager/index.js";
import {
  evaluateKnowledgeShare,
  type KnowledgeShareGrant,
} from "./sharing-gate/index.js";
import {
  evaluateChineseWallPolicy,
  type ChineseWallPolicy,
} from "./chinese-wall-policy.js";

export interface KnowledgeAccessDecision {
  readonly allowed: boolean;
  readonly boundaryId: string;
  readonly tenantId: string | null;
  readonly accessLog: KnowledgeAccessLogRecord;
  readonly reasonCodes: readonly string[];
  readonly relatedBoundaryIds?: readonly string[];
  readonly dynamicPolicyApplied?: boolean;
  readonly violationCodes?: readonly string[];
}

export interface DynamicKnowledgeIsolationPolicy {
  readonly policyId: string;
  readonly blockedRequesterIds?: readonly string[];
  readonly deniedPurposes?: readonly string[];
  readonly requiredGrantBoundaryIds?: readonly string[];
}

export interface KnowledgeIsolationViolation {
  readonly violationId: string;
  readonly boundaryId: string;
  readonly requesterId: string;
  readonly code: string;
  readonly occurredAt: string;
}

export class KnowledgeBoundaryService {
  private readonly accessLogs = new Map<string, KnowledgeAccessLogRecord[]>();
  private readonly violations = new Map<string, KnowledgeIsolationViolation[]>();

  public evaluateAccess(
    boundary: KnowledgeBoundary,
    requesterId: string,
    requesterOrgNodeId: string,
    purpose: string,
    grants: readonly KnowledgeShareGrant[],
    chineseWallPolicy?: ChineseWallPolicy,
    occurredAt = nowIso(),
    tenantId: string | null = null,
  ): KnowledgeAccessDecision {
    return this.evaluateDynamicAccess({
      boundary,
      requesterId,
      requesterOrgNodeId,
      purpose,
      grants,
      ...(chineseWallPolicy !== undefined ? { chineseWallPolicy } : {}),
      occurredAt,
      tenantId,
    });
  }

  public evaluateDynamicAccess(input: {
    boundary: KnowledgeBoundary;
    requesterId: string;
    requesterOrgNodeId: string;
    purpose: string;
    grants: readonly KnowledgeShareGrant[];
    chineseWallPolicy?: ChineseWallPolicy;
    dynamicPolicy?: DynamicKnowledgeIsolationPolicy;
    occurredAt?: string;
    relatedBoundaryIds?: readonly string[];
    tenantId?: string | null;
  }): KnowledgeAccessDecision {
    const occurredAt = input.occurredAt ?? nowIso();
    const chineseWallDecision = input.chineseWallPolicy == null
      ? { allowed: true, reasonCodes: ["knowledge_boundary.no_chinese_wall"], blockedGroupId: null, constraint: null }
      : evaluateChineseWallPolicy(input.chineseWallPolicy, input.requesterOrgNodeId, input.boundary.ownerOrgNodeId);
    const dynamicPolicyReasons: string[] = [];
    const dynamicPolicyAllowed = this.evaluateDynamicPolicy(
      input.dynamicPolicy,
      input.requesterId,
      input.requesterOrgNodeId,
      input.purpose,
      input.grants,
      input.boundary.boundaryId,
      dynamicPolicyReasons,
    );
    const tenantAllowed = this.evaluateTenantScope(input.boundary.tenantId ?? null, input.tenantId ?? null);
    const allowed = chineseWallDecision.allowed
      && dynamicPolicyAllowed
      && tenantAllowed
      && (
        canAccessKnowledgeBoundary(input.boundary, input.requesterOrgNodeId)
        || evaluateKnowledgeShare(input.boundary, input.requesterOrgNodeId, input.grants, occurredAt) != null
      );
    const log: KnowledgeAccessLogRecord = {
      recordId: `knowledge_access_${input.boundary.boundaryId}_${input.requesterId}_${occurredAt}`,
      requesterId: input.requesterId,
      boundaryId: input.boundary.boundaryId,
      tenantId: input.boundary.tenantId ?? input.tenantId ?? null,
      purpose: input.purpose,
      allowed,
      occurredAt,
    };
    this.accessLogs.set(input.boundary.boundaryId, [...(this.accessLogs.get(input.boundary.boundaryId) ?? []), log]);
    const violationCodes = allowed
      ? []
      : [
        ...(tenantAllowed ? [] : ["knowledge_boundary.tenant_scope_denied"]),
        ...dynamicPolicyReasons,
        ...chineseWallDecision.reasonCodes,
        "knowledge_boundary.access_denied",
      ];
    if (violationCodes.length > 0) {
      const violations = violationCodes.map((code, index) => ({
        violationId: `${log.recordId}_violation_${index + 1}`,
        boundaryId: input.boundary.boundaryId,
        requesterId: input.requesterId,
        code,
        occurredAt,
      }));
      this.violations.set(input.boundary.boundaryId, [...(this.violations.get(input.boundary.boundaryId) ?? []), ...violations]);
    }
    return {
      allowed,
      boundaryId: input.boundary.boundaryId,
      tenantId: input.boundary.tenantId ?? input.tenantId ?? null,
      accessLog: log,
      relatedBoundaryIds: input.relatedBoundaryIds ?? [],
      dynamicPolicyApplied: input.dynamicPolicy != null,
      violationCodes,
      reasonCodes: allowed
        ? [...chineseWallDecision.reasonCodes, ...dynamicPolicyReasons]
        : violationCodes,
    };
  }

  public listRedactedLogs(boundaryId: string): KnowledgeAccessLogRecord[] {
    return (this.accessLogs.get(boundaryId) ?? []).map((item) => redactKnowledgeAccessLog(item));
  }

  public traceBoundaryAccess(boundaryId: string): readonly KnowledgeAccessLogRecord[] {
    return [...(this.accessLogs.get(boundaryId) ?? [])];
  }

  public listIsolationViolations(boundaryId: string): readonly KnowledgeIsolationViolation[] {
    return [...(this.violations.get(boundaryId) ?? [])];
  }

  private evaluateDynamicPolicy(
    policy: DynamicKnowledgeIsolationPolicy | undefined,
    requesterId: string,
    requesterOrgNodeId: string,
    purpose: string,
    grants: readonly KnowledgeShareGrant[],
    boundaryId: string,
    reasonCodes: string[],
  ): boolean {
    if (policy == null) {
      return true;
    }
    if (policy.blockedRequesterIds?.includes(requesterId)) {
      reasonCodes.push(`knowledge_boundary.blocked_requester:${policy.policyId}`);
      return false;
    }
    if (policy.deniedPurposes?.includes(purpose)) {
      reasonCodes.push(`knowledge_boundary.denied_purpose:${policy.policyId}`);
      return false;
    }
    if (policy.requiredGrantBoundaryIds != null && policy.requiredGrantBoundaryIds.length > 0) {
      const grantedBoundaryIds = new Set(
        grants
          .filter((grant) => {
            const grantedToOrgNodeId = (grant as { grantedToOrgNodeId?: string }).grantedToOrgNodeId
              ?? grant.requesterOrgNodeId;
            return grantedToOrgNodeId === requesterOrgNodeId;
          })
          .map((grant) => grant.boundaryId),
      );
      const missingRequiredGrant = policy.requiredGrantBoundaryIds.some((grantBoundaryId) => !grantedBoundaryIds.has(grantBoundaryId));
      if (missingRequiredGrant) {
        reasonCodes.push(`knowledge_boundary.required_grant_missing:${policy.policyId}`);
        return false;
      }
    }
    return true;
  }

  private evaluateTenantScope(boundaryTenantId: string | null, requesterTenantId: string | null): boolean {
    if (boundaryTenantId == null && requesterTenantId == null) {
      return true;
    }
    if (boundaryTenantId == null || requesterTenantId == null) {
      return false;
    }
    return boundaryTenantId === requesterTenantId;
  }
}
