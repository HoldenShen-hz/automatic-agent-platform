import type { ArchivedKnowledgeRecord } from "./archive/knowledge-archive.js";
export type KnowledgeGraphNodeType = "namespace" | "document" | "chunk" | "keyword";
export type KnowledgeGraphEdgeType = "contains" | "shared_keyword" | "same_document";
export interface KnowledgeGraphNode {
    nodeId: string;
    nodeType: KnowledgeGraphNodeType;
    label: string;
    namespace: string | null;
    knowledgeRef: string | null;
}
export interface KnowledgeGraphEdge {
    edgeId: string;
    fromNodeId: string;
    toNodeId: string;
    relation: KnowledgeGraphEdgeType;
    weight: number;
}
export interface KnowledgeGraphInspection {
    nodes: KnowledgeGraphNode[];
    edges: KnowledgeGraphEdge[];
}
export interface KnowledgeGraphChunkConnections {
    knowledgeRef: string;
    namespace: string | null;
    keywords: string[];
    sharedKeywordRefs: string[];
    sameDocumentRefs: string[];
}
export declare class SemanticKnowledgeGraph {
    private readonly nodes;
    private readonly edges;
    private readonly adjacencyByNodeId;
    private readonly chunkByKnowledgeRef;
    private readonly keywordToChunkIds;
    private readonly chunkToKeywordIds;
    replace(records: readonly ArchivedKnowledgeRecord[]): void;
    upsertRecord(record: ArchivedKnowledgeRecord): void;
    findChunkKnowledgeRefsByKeyword(keyword: string, namespace?: string): string[];
    getChunkConnections(knowledgeRef: string): KnowledgeGraphChunkConnections | null;
    inspect(input?: {
        namespace?: string;
        knowledgeRef?: string;
        keyword?: string;
        limit?: number;
    }): KnowledgeGraphInspection;
    private collectAdjacent;
    private collectChunkKnowledgeRefs;
    private addUndirectedEdge;
    private addEdge;
}
