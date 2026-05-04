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

/**
 * R19-11: Knowledge taint record tracking contamination from sensitive boundaries.
 * When a requester accesses a sensitive boundary, their knowledge becomes tainted.
 */
export interface KnowledgeTaintRecord {
  readonly taintId: string;
  readonly requesterId: string;
  readonly boundaryId: string;
  readonly taintLevel: "full" | "partial" | "residual";
  readonly sourceDataClasses: readonly string[];
  readonly occurredAt: string;
  readonly expiresAt: string | null;
}

/**
 * R19-10: Information barrier crossing check result.
 */
export interface InformationBarrierCheckResult {
  readonly allowed: boolean;
  readonly barrierId: string | null;
  readonly reasonCodes: readonly string[];
  readonly taintPropagationRisk: boolean;
}

export class KnowledgeBoundaryService {
  private readonly accessLogs = new Map<string, KnowledgeAccessLogRecord[]>();
  private readonly violations = new Map<string, KnowledgeIsolationViolation[]>();
  // R19-11: Knowledge taint tracking - maps requesterId to their taint records
  private readonly knowledgeTaints = new Map<string, KnowledgeTaintRecord[]>();

  // R19-10: Information barrier definitions per boundary
  private readonly informationBarriers = new Map<string, {
    readonly barrierId: string;
    readonly blockedBoundaryIds: readonly string[];
    readonly requiresTaintClearance: boolean;
  }>();

  // R19-11: Default taint expiry in days
  private static readonly DEFAULT_TAINT_EXPIRY_DAYS = 30;

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
      ? { allowed: true, reasonCodes: ["knowledge_boundary.no_chinese_wall"] }
      : evaluateChineseWallPolicy(input.chineseWallPolicy, input.requesterOrgNodeId, input.boundary.ownerOrgNodeId);
    const dynamicPolicyReasons: string[] = [];
    const dynamicPolicyAllowed = this.evaluateDynamicPolicy(
      input.dynamicPolicy,
      input.requesterId,
      input.purpose,
      input.grants,
      input.boundary.boundaryId,
      dynamicPolicyReasons,
    );
    const tenantAllowed = this.evaluateTenantScope(input.boundary.tenantId ?? null, input.tenantId ?? null);
    const shareTransform = evaluateKnowledgeShare(input.boundary, input.requesterOrgNodeId, input.grants, occurredAt);
    const allowed = chineseWallDecision.allowed
      && dynamicPolicyAllowed
      && tenantAllowed
      && (
        canAccessKnowledgeBoundary(input.boundary, input.requesterOrgNodeId)
        || shareTransform !== null
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

    // R19-11: Record knowledge taint when access is granted
    if (allowed) {
      // Extract data classes from boundary or grants for taint tracking
      const dataClasses = this.extractDataClasses(input.boundary, input.grants);
      const taintLevel = dataClasses.length > 0 ? "partial" : "residual";
      this.recordKnowledgeTaint(input.requesterId, input.boundary.boundaryId, dataClasses, taintLevel);

      // R19-11: Propagate taint to related boundaries if specified
      if (input.relatedBoundaryIds && input.relatedBoundaryIds.length > 0) {
        this.propagateTaint(input.requesterId, input.boundary.boundaryId, input.relatedBoundaryIds, "residual");
      }
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

  // R19-10: Register an information barrier between boundaries
  public registerInformationBarrier(
    barrierId: string,
    blockedBoundaryIds: readonly string[],
    requiresTaintClearance: boolean = true,
  ): void {
    this.informationBarriers.set(barrierId, {
      barrierId,
      blockedBoundaryIds,
      requiresTaintClearance,
    });
  }

  // R19-10: Check if crossing information barriers is allowed
  public checkInformationBarrier(
    requesterId: string,
    sourceBoundaryId: string,
    targetBoundaryId: string,
  ): InformationBarrierCheckResult {
    const now = nowIso();

    // Find any barrier that blocks this crossing
    for (const barrier of this.informationBarriers.values()) {
      const blocksCrossing = barrier.blockedBoundaryIds.includes(sourceBoundaryId)
        && barrier.blockedBoundaryIds.includes(targetBoundaryId);

      if (!blocksCrossing) {
        continue;
      }

      // R19-10: If barrier requires taint clearance, check for valid taint
      if (barrier.requiresTaintClearance) {
        const taints = this.knowledgeTaints.get(requesterId) ?? [];
        const hasClearance = taints.some((taint) => {
          if (taint.boundaryId !== sourceBoundaryId) {
            return false;
          }
          if (taint.expiresAt != null && Date.parse(taint.expiresAt) < Date.parse(now)) {
            return false;
          }
          return taint.taintLevel === "full" || taint.taintLevel === "partial";
        });

        if (!hasClearance) {
          return {
            allowed: false,
            barrierId: barrier.barrierId,
            reasonCodes: [
              `knowledge_boundary.information_barrier:${barrier.barrierId}`,
              "knowledge_boundary.taint_clearance_required",
            ],
            taintPropagationRisk: true,
          };
        }
      }

      return {
        allowed: false,
        barrierId: barrier.barrierId,
        reasonCodes: [`knowledge_boundary.information_barrier:${barrier.barrierId}`],
        taintPropagationRisk: false,
      };
    }

    return {
      allowed: true,
      barrierId: null,
      reasonCodes: ["knowledge_boundary.no_barrier"],
      taintPropagationRisk: false,
    };
  }

  // R19-11: Record knowledge taint from boundary access
  public recordKnowledgeTaint(
    requesterId: string,
    boundaryId: string,
    sourceDataClasses: readonly string[],
    taintLevel: KnowledgeTaintRecord["taintLevel"] = "partial",
    expiresAt: string | null = null,
  ): KnowledgeTaintRecord {
    const now = nowIso();
    const expiry = expiresAt ?? new Date(
      Date.parse(now) + KnowledgeBoundaryService.DEFAULT_TAINT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const taint: KnowledgeTaintRecord = {
      taintId: `taint_${requesterId}_${boundaryId}_${now}`,
      requesterId,
      boundaryId,
      taintLevel,
      sourceDataClasses: [...sourceDataClasses],
      occurredAt: now,
      expiresAt: expiry,
    };

    const existing = this.knowledgeTaints.get(requesterId) ?? [];
    // Update existing taint from same boundary or add new
    const updated = existing.filter((t) => t.boundaryId !== boundaryId);
    updated.push(taint);
    this.knowledgeTaints.set(requesterId, updated);

    return taint;
  }

  // R19-11: Get all knowledge taints for a requester
  public getKnowledgeTaints(requesterId: string, nowIsoStr?: string): readonly KnowledgeTaintRecord[] {
    const now = nowIsoStr ?? nowIso();
    const taints = this.knowledgeTaints.get(requesterId) ?? [];

    // Filter out expired taints
    return taints.filter((taint) => {
      if (taint.expiresAt == null) {
        return true;
      }
      return Date.parse(taint.expiresAt) > Date.parse(now);
    });
  }

  // R19-11: Propagate taint to related boundaries
  public propagateTaint(
    requesterId: string,
    sourceBoundaryId: string,
    relatedBoundaryIds: readonly string[],
    propagationLevel: KnowledgeTaintRecord["taintLevel"] = "residual",
  ): readonly KnowledgeTaintRecord[] {
    const propagated: KnowledgeTaintRecord[] = [];
    const now = nowIso();
    const sourceTaints = this.knowledgeTaints.get(requesterId) ?? [];
    const sourceTaint = sourceTaints.find((t) => t.boundaryId === sourceBoundaryId);

    // Use source taint data classes or default
    const dataClasses = sourceTaint?.sourceDataClasses ?? ["unknown"];

    for (const relatedBoundaryId of relatedBoundaryIds) {
      if (relatedBoundaryId === sourceBoundaryId) {
        continue;
      }
      const taint = this.recordKnowledgeTaint(
        requesterId,
        relatedBoundaryId,
        dataClasses,
        propagationLevel,
        sourceTaint?.expiresAt ?? null,
      );
      propagated.push(taint);
    }

    return propagated;
  }

  // R19-11: Clear taint for a requester (e.g., after cooling off period)
  public clearKnowledgeTaint(requesterId: string, boundaryId: string): boolean {
    const existing = this.knowledgeTaints.get(requesterId) ?? [];
    const updated = existing.filter((t) => t.boundaryId !== boundaryId);
    if (updated.length === existing.length) {
      return false;
    }
    this.knowledgeTaints.set(requesterId, updated);
    return true;
  }

  // R19-11: Extract data classes from boundary and grants for taint tracking
  private extractDataClasses(
    boundary: KnowledgeBoundary,
    grants: readonly KnowledgeShareGrant[],
  ): readonly string[] {
    // Extract from boundary metadata if available
    const boundaryDataClasses = (boundary as { dataClasses?: readonly string[] }).dataClasses ?? [];
    // Extract from grants
    const grantDataClasses = grants.flatMap((grant) =>
      (grant as { dataClasses?: readonly string[] }).dataClasses ?? [],
    );
    // Combine and deduplicate
    const allClasses = [...boundaryDataClasses, ...grantDataClasses];
    return [...new Set(allClasses)];
  }

  private evaluateDynamicPolicy(
    policy: DynamicKnowledgeIsolationPolicy | undefined,
    requesterId: string,
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
      const grantedBoundaryIds = new Set(grants.filter((grant) => grant.boundaryId === boundaryId).map((grant) => grant.boundaryId));
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
