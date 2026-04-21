import { type KnowledgeAccessPrincipal } from "../governance/access-control.js";
import { KnowledgeAuditLogger } from "../governance/knowledge-audit-logger.js";
import type { KnowledgeArchive } from "../archive/knowledge-archive.js";
import type { KeywordKnowledgeIndex } from "../keyword-index.js";
import type { NamespacePolicyStore } from "../governance/namespace-policy.js";
import type { RetrievalHit } from "../knowledge-model.js";
import type { SemanticKnowledgeGraph } from "../semantic-knowledge-graph.js";
import type { SemanticVectorStore } from "../semantic-vector-store.js";
export interface KnowledgeQueryOptions {
    namespace?: string;
    domainId?: string | null;
    accessPrincipal?: KnowledgeAccessPrincipal | null;
    includeUnverified?: boolean;
    limit?: number;
}
export declare class KnowledgeRetrievalService {
    private readonly index;
    private readonly archive;
    private readonly namespacePolicies;
    private readonly semanticGraph;
    private readonly semanticVectorStore;
    private readonly accessControl;
    private readonly auditLogger;
    private readonly freshness;
    private readonly trustPolicies;
    private readonly citations;
    constructor(index: KeywordKnowledgeIndex, archive: KnowledgeArchive, namespacePolicies: NamespacePolicyStore, semanticGraph?: SemanticKnowledgeGraph | null, semanticVectorStore?: SemanticVectorStore | null, auditLogger?: KnowledgeAuditLogger);
    query(keyword: string, options?: KnowledgeQueryOptions): RetrievalHit[];
    queryAsync(keyword: string, options?: KnowledgeQueryOptions): Promise<RetrievalHit[]>;
    filterAuthorizedHits(hits: readonly RetrievalHit[], options?: KnowledgeQueryOptions): RetrievalHit[];
    private buildQueryResults;
    private buildRankedHit;
    private collectSemanticCandidates;
    private collectSemanticCandidatesAsync;
    private getAccessContext;
}
