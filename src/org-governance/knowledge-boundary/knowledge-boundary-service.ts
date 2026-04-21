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
  readonly accessLog: KnowledgeAccessLogRecord;
  readonly reasonCodes: readonly string[];
}

export class KnowledgeBoundaryService {
  private readonly accessLogs = new Map<string, KnowledgeAccessLogRecord[]>();

  public evaluateAccess(
    boundary: KnowledgeBoundary,
    requesterId: string,
    requesterOrgNodeId: string,
    purpose: string,
    grants: readonly KnowledgeShareGrant[],
    chineseWallPolicy?: ChineseWallPolicy,
    occurredAt = nowIso(),
  ): KnowledgeAccessDecision {
    const chineseWallDecision = chineseWallPolicy == null
      ? { allowed: true, reasonCodes: ["knowledge_boundary.no_chinese_wall"] }
      : evaluateChineseWallPolicy(chineseWallPolicy, requesterOrgNodeId, boundary.ownerOrgNodeId);
    const allowed = chineseWallDecision.allowed && (
      canAccessKnowledgeBoundary(boundary, requesterOrgNodeId)
      || evaluateKnowledgeShare(boundary, requesterOrgNodeId, grants, occurredAt)
    );
    const log: KnowledgeAccessLogRecord = {
      recordId: `knowledge_access_${boundary.boundaryId}_${requesterId}_${occurredAt}`,
      requesterId,
      boundaryId: boundary.boundaryId,
      purpose,
      allowed,
      occurredAt,
    };
    this.accessLogs.set(boundary.boundaryId, [...(this.accessLogs.get(boundary.boundaryId) ?? []), log]);
    return {
      allowed,
      boundaryId: boundary.boundaryId,
      accessLog: log,
      reasonCodes: allowed
        ? chineseWallDecision.reasonCodes
        : [...chineseWallDecision.reasonCodes, "knowledge_boundary.access_denied"],
    };
  }

  public listRedactedLogs(boundaryId: string): KnowledgeAccessLogRecord[] {
    return (this.accessLogs.get(boundaryId) ?? []).map((item) => redactKnowledgeAccessLog(item));
  }
}
