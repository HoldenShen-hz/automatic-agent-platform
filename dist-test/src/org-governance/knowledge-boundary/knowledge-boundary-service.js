import { nowIso } from "../../platform/contracts/types/ids.js";
import { redactKnowledgeAccessLog, } from "./access-log/index.js";
import { canAccessKnowledgeBoundary, } from "./boundary-manager/index.js";
import { evaluateKnowledgeShare, } from "./sharing-gate/index.js";
import { evaluateChineseWallPolicy, } from "./chinese-wall-policy.js";
export class KnowledgeBoundaryService {
    accessLogs = new Map();
    evaluateAccess(boundary, requesterId, requesterOrgNodeId, purpose, grants, chineseWallPolicy, occurredAt = nowIso()) {
        const chineseWallDecision = chineseWallPolicy == null
            ? { allowed: true, reasonCodes: ["knowledge_boundary.no_chinese_wall"] }
            : evaluateChineseWallPolicy(chineseWallPolicy, requesterOrgNodeId, boundary.ownerOrgNodeId);
        const allowed = chineseWallDecision.allowed && (canAccessKnowledgeBoundary(boundary, requesterOrgNodeId)
            || evaluateKnowledgeShare(boundary, requesterOrgNodeId, grants, occurredAt));
        const log = {
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
    listRedactedLogs(boundaryId) {
        return (this.accessLogs.get(boundaryId) ?? []).map((item) => redactKnowledgeAccessLog(item));
    }
}
//# sourceMappingURL=knowledge-boundary-service.js.map