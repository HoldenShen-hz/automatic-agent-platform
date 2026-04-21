import { type KnowledgeAccessLogRecord } from "./access-log/index.js";
import { type KnowledgeBoundary } from "./boundary-manager/index.js";
import { type KnowledgeShareGrant } from "./sharing-gate/index.js";
export interface KnowledgeAccessDecision {
    readonly allowed: boolean;
    readonly boundaryId: string;
    readonly accessLog: KnowledgeAccessLogRecord;
}
export declare class KnowledgeBoundaryService {
    private readonly accessLogs;
    evaluateAccess(boundary: KnowledgeBoundary, requesterId: string, requesterOrgNodeId: string, purpose: string, grants: readonly KnowledgeShareGrant[], occurredAt?: string): KnowledgeAccessDecision;
    listRedactedLogs(boundaryId: string): KnowledgeAccessLogRecord[];
}
