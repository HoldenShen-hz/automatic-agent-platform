import { KnowledgeArchive } from "./archive/knowledge-archive.js";
import { NamespacePolicyStore } from "./governance/namespace-policy.js";
import { AstStructuralIndex } from "./indexing/ast-index.js";
import type { ChunkingConfig, KnowledgeChunk, KnowledgeDocument, KnowledgeNamespace, KnowledgeSource, TrustLevel } from "./knowledge-model.js";
import { KeywordKnowledgeIndex } from "./keyword-index.js";
import { KnowledgeRetrievalService } from "./retrieval/knowledge-retrieval.js";
export interface KnowledgeIngestionResult {
    source: KnowledgeSource;
    document: KnowledgeDocument;
    chunks: KnowledgeChunk[];
}
export declare class KnowledgeIngestionPipeline {
    private readonly index;
    private readonly astIndex;
    private readonly archive;
    private readonly namespaces;
    private readonly retrieval;
    constructor(index?: KeywordKnowledgeIndex, archive?: KnowledgeArchive, namespaces?: NamespacePolicyStore, astIndex?: AstStructuralIndex);
    registerNamespace(namespace: KnowledgeNamespace): KnowledgeNamespace;
    ingest(input: {
        title: string;
        body: string;
        namespace: string;
        uri?: string;
        sourceType?: KnowledgeSource["type"];
        trustLevel?: TrustLevel;
        tags?: readonly string[];
        language?: string | null;
        chunking?: ChunkingConfig;
    }): KnowledgeIngestionResult;
    query(keyword: string, options?: Parameters<KnowledgeRetrievalService["query"]>[1]): {
        namespace: string;
        documentId: string;
        chunkId: string;
        snippet: string;
        score: number;
        matchType: "semantic" | "keyword" | "structural";
        knowledgeRef: string;
        reasoningSummary?: string | undefined;
        rankingSignals?: {
            keywordMatches: string[];
            exactMatchScore: number;
            semanticSimilarity: number;
            keywordCoverage: number;
            sharedKeywordNeighborCount: number;
            sameDocumentNeighborCount: number;
            trustMultiplier: number;
            freshnessMultiplier: number;
            namespaceBoost: number;
            graphBoost: number;
            reasoningPaths: string[];
        } | undefined;
    }[];
    private createChunks;
}
