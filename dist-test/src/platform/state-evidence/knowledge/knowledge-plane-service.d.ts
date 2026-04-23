import type { RetrievalHit } from "./knowledge-model.js";
import { KnowledgeArchive } from "./archive/knowledge-archive.js";
import { KnowledgeSnapshotStore } from "./archive/knowledge-snapshot-store.js";
import { KnowledgeAuditLogger } from "./governance/knowledge-audit-logger.js";
import { NamespacePolicyStore } from "./governance/namespace-policy.js";
import { KeywordKnowledgeIndex } from "./keyword-index.js";
import { KnowledgeIngestionPipeline, type KnowledgeIngestionResult } from "./knowledge-ingestion-pipeline.js";
import { type KnowledgeQueryOptions } from "./retrieval/knowledge-retrieval.js";
import { SemanticKnowledgeGraph } from "./semantic-knowledge-graph.js";
import type { SemanticVectorStore } from "./semantic-vector-store.js";
import { DomainRegistryService } from "../../../domains/registry/domain-registry-service.js";
import { PluginSpiRegistry } from "../../../domains/registry/plugin-spi-registry.js";
import type { TypedEventPublisher } from "../events/typed-event-publisher.js";
export interface KnowledgePlaneServiceOptions {
    index?: KeywordKnowledgeIndex;
    archive?: KnowledgeArchive;
    namespaces?: NamespacePolicyStore;
    domainRegistry?: DomainRegistryService;
    pluginRegistry?: PluginSpiRegistry;
    snapshotStore?: KnowledgeSnapshotStore;
    semanticGraph?: SemanticKnowledgeGraph;
    semanticVectorStore?: SemanticVectorStore | null;
    eventPublisher?: TypedEventPublisher;
    knowledgeAuditLogger?: KnowledgeAuditLogger;
}
export declare class KnowledgePlaneService {
    private readonly archive;
    private readonly retrieval;
    private readonly pipeline;
    private readonly namespaces;
    private readonly domainRegistry;
    private readonly pluginRegistry;
    private readonly snapshotStore;
    private readonly semanticGraph;
    private readonly semanticVectorStore;
    private readonly eventPublisher;
    private pendingSemanticSync;
    private semanticSyncScheduled;
    constructor(options?: KnowledgePlaneServiceOptions);
    initialize(): Promise<void>;
    registerNamespace(...args: Parameters<KnowledgeIngestionPipeline["registerNamespace"]>): {
        path: string;
        freshnessPolicy: {
            maxAgeDays: number;
            staleAction: "warn" | "delete" | "demote" | "archive";
            refreshStrategy: "manual" | "scheduled" | "on_access";
            refreshIntervalHours: number | null;
        };
        trustLevel: "verified" | "community" | "unverified" | "reviewed";
        description: string;
        namespaceId: string;
        ownerDomainId: string;
        accessPolicy: "restricted" | "public" | "domain_only";
        maxDocuments: number;
        maxTotalSizeBytes: number;
    };
    query(keyword: string, options?: KnowledgeQueryOptions): RetrievalHit[];
    queryAsync(keyword: string, options?: KnowledgeQueryOptions): Promise<RetrievalHit[]>;
    listNamespaces(): {
        path: string;
        freshnessPolicy: {
            maxAgeDays: number;
            staleAction: "warn" | "delete" | "demote" | "archive";
            refreshStrategy: "manual" | "scheduled" | "on_access";
            refreshIntervalHours: number | null;
        };
        trustLevel: "verified" | "community" | "unverified" | "reviewed";
        description: string;
        namespaceId: string;
        ownerDomainId: string;
        accessPolicy: "restricted" | "public" | "domain_only";
        maxDocuments: number;
        maxTotalSizeBytes: number;
    }[];
    inspectNamespace(namespace: string): {
        namespace: string;
        status: string;
        policy: {
            path: string;
            freshnessPolicy: {
                maxAgeDays: number;
                staleAction: "warn" | "delete" | "demote" | "archive";
                refreshStrategy: "manual" | "scheduled" | "on_access";
                refreshIntervalHours: number | null;
            };
            trustLevel: "verified" | "community" | "unverified" | "reviewed";
            description: string;
            namespaceId: string;
            ownerDomainId: string;
            accessPolicy: "restricted" | "public" | "domain_only";
            maxDocuments: number;
            maxTotalSizeBytes: number;
        } | null;
        documentCount: number;
        chunkCount: number;
        documents: {
            documentId: string;
            title: string;
            version: number;
            status: "draft" | "deprecated" | "archived" | "indexed";
            sourceId: string;
            trustLevel: "verified" | "community" | "unverified" | "reviewed";
            chunkCount: number;
        }[];
    };
    inspectGraph(input?: {
        namespace?: string;
        knowledgeRef?: string;
        keyword?: string;
        limit?: number;
    }): import("./semantic-knowledge-graph.js").KnowledgeGraphInspection;
    queryForDomain(keyword: string, options: KnowledgeQueryOptions & {
        domainId: string;
        includePluginRetrieval?: boolean;
        tokenBudget?: number;
    }): Promise<RetrievalHit[]>;
    private restoreSnapshot;
    private persistSnapshot;
    ingest(...args: Parameters<KnowledgeIngestionPipeline["ingest"]>): KnowledgeIngestionResult;
    ingestAsync(...args: Parameters<KnowledgeIngestionPipeline["ingest"]>): Promise<KnowledgeIngestionResult>;
    inspectSemanticInfrastructure(): import("./semantic-vector-store.js").SemanticVectorStoreProfile;
    private scheduleSemanticUpsert;
    private scheduleSemanticUpsertRecords;
    private awaitSemanticSync;
}
