import type { KnowledgeBoundary } from "./boundary-manager/index.js";
import { type ChineseWallPolicy } from "./chinese-wall-policy.js";
export interface FederatedKnowledgeSource {
    readonly sourceId: string;
    readonly boundaryId: string;
    readonly orgNodeId: string;
    readonly title: string;
    readonly content: string;
    readonly tags: readonly string[];
}
export interface FederatedKnowledgeQuery {
    readonly requesterOrgNodeId: string;
    readonly query: string;
    readonly boundaryIds?: readonly string[];
}
export interface FederatedKnowledgeResult {
    readonly sourceId: string;
    readonly boundaryId: string;
    readonly title: string;
    readonly excerpt: string;
    readonly matchedTags: readonly string[];
}
export declare class KnowledgeFederator {
    search(sources: readonly FederatedKnowledgeSource[], boundaries: readonly KnowledgeBoundary[], query: FederatedKnowledgeQuery, policy?: ChineseWallPolicy): FederatedKnowledgeResult[];
}
