import { z } from "zod";
/**
 * Knowledge source for domain knowledge schema.
 * As defined in architecture doc §37.4 DomainKnowledgeSchema.
 */
export declare const KnowledgeSourceSchema: z.ZodObject<{
    sourceId: z.ZodString;
    type: z.ZodEnum<["document_store", "api_realtime", "database", "embedding_index", "structured_kb"]>;
    priority: z.ZodDefault<z.ZodNumber>;
    refreshInterval: z.ZodDefault<z.ZodString>;
    authScope: z.ZodString;
    endpoint: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "document_store" | "api_realtime" | "database" | "embedding_index" | "structured_kb";
    sourceId: string;
    priority: number;
    refreshInterval: string;
    authScope: string;
    endpoint?: string | undefined;
}, {
    type: "document_store" | "api_realtime" | "database" | "embedding_index" | "structured_kb";
    sourceId: string;
    authScope: string;
    priority?: number | undefined;
    refreshInterval?: string | undefined;
    endpoint?: string | undefined;
}>;
/**
 * Retrieval strategy for domain knowledge.
 * As defined in architecture doc §37.4 DomainKnowledgeSchema.
 */
export declare const RetrievalStrategySchema: z.ZodObject<{
    strategy: z.ZodDefault<z.ZodEnum<["semantic", "keyword", "hybrid", "exact"]>>;
    maxResults: z.ZodDefault<z.ZodNumber>;
    minRelevanceScore: z.ZodDefault<z.ZodNumber>;
    rerankEnabled: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    strategy: "exact" | "semantic" | "keyword" | "hybrid";
    maxResults: number;
    minRelevanceScore: number;
    rerankEnabled: boolean;
}, {
    strategy?: "exact" | "semantic" | "keyword" | "hybrid" | undefined;
    maxResults?: number | undefined;
    minRelevanceScore?: number | undefined;
    rerankEnabled?: boolean | undefined;
}>;
/**
 * Freshness policy for domain knowledge.
 * As defined in architecture doc §37.4 DomainKnowledgeSchema.
 */
export declare const FreshnessPolicySchema: z.ZodObject<{
    maxStalenessHours: z.ZodDefault<z.ZodNumber>;
    refreshTrigger: z.ZodDefault<z.ZodEnum<["on_demand", "scheduled", "event_driven"]>>;
    backgroundRefreshEnabled: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    maxStalenessHours: number;
    refreshTrigger: "scheduled" | "on_demand" | "event_driven";
    backgroundRefreshEnabled: boolean;
}, {
    maxStalenessHours?: number | undefined;
    refreshTrigger?: "scheduled" | "on_demand" | "event_driven" | undefined;
    backgroundRefreshEnabled?: boolean | undefined;
}>;
export declare const DomainKnowledgeSchemaSchema: z.ZodObject<{
    schemaId: z.ZodString;
    domainId: z.ZodString;
    namespaceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    freshnessWindowHours: z.ZodDefault<z.ZodNumber>;
    conflictResolution: z.ZodDefault<z.ZodEnum<["latest_wins", "trust_priority", "human_review"]>>;
    retentionDays: z.ZodDefault<z.ZodNumber>;
    knowledgeSources: z.ZodDefault<z.ZodArray<z.ZodObject<{
        sourceId: z.ZodString;
        type: z.ZodEnum<["document_store", "api_realtime", "database", "embedding_index", "structured_kb"]>;
        priority: z.ZodDefault<z.ZodNumber>;
        refreshInterval: z.ZodDefault<z.ZodString>;
        authScope: z.ZodString;
        endpoint: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "document_store" | "api_realtime" | "database" | "embedding_index" | "structured_kb";
        sourceId: string;
        priority: number;
        refreshInterval: string;
        authScope: string;
        endpoint?: string | undefined;
    }, {
        type: "document_store" | "api_realtime" | "database" | "embedding_index" | "structured_kb";
        sourceId: string;
        authScope: string;
        priority?: number | undefined;
        refreshInterval?: string | undefined;
        endpoint?: string | undefined;
    }>, "many">>;
    retrievalStrategy: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        strategy: z.ZodDefault<z.ZodEnum<["semantic", "keyword", "hybrid", "exact"]>>;
        maxResults: z.ZodDefault<z.ZodNumber>;
        minRelevanceScore: z.ZodDefault<z.ZodNumber>;
        rerankEnabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        strategy: "exact" | "semantic" | "keyword" | "hybrid";
        maxResults: number;
        minRelevanceScore: number;
        rerankEnabled: boolean;
    }, {
        strategy?: "exact" | "semantic" | "keyword" | "hybrid" | undefined;
        maxResults?: number | undefined;
        minRelevanceScore?: number | undefined;
        rerankEnabled?: boolean | undefined;
    }>>>;
    freshnessPolicy: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        maxStalenessHours: z.ZodDefault<z.ZodNumber>;
        refreshTrigger: z.ZodDefault<z.ZodEnum<["on_demand", "scheduled", "event_driven"]>>;
        backgroundRefreshEnabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        maxStalenessHours: number;
        refreshTrigger: "scheduled" | "on_demand" | "event_driven";
        backgroundRefreshEnabled: boolean;
    }, {
        maxStalenessHours?: number | undefined;
        refreshTrigger?: "scheduled" | "on_demand" | "event_driven" | undefined;
        backgroundRefreshEnabled?: boolean | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    domainId: string;
    schemaId: string;
    namespaceIds: string[];
    freshnessWindowHours: number;
    conflictResolution: "latest_wins" | "trust_priority" | "human_review";
    retentionDays: number;
    knowledgeSources: {
        type: "document_store" | "api_realtime" | "database" | "embedding_index" | "structured_kb";
        sourceId: string;
        priority: number;
        refreshInterval: string;
        authScope: string;
        endpoint?: string | undefined;
    }[];
    retrievalStrategy: {
        strategy: "exact" | "semantic" | "keyword" | "hybrid";
        maxResults: number;
        minRelevanceScore: number;
        rerankEnabled: boolean;
    };
    freshnessPolicy: {
        maxStalenessHours: number;
        refreshTrigger: "scheduled" | "on_demand" | "event_driven";
        backgroundRefreshEnabled: boolean;
    };
}, {
    domainId: string;
    schemaId: string;
    namespaceIds?: string[] | undefined;
    freshnessWindowHours?: number | undefined;
    conflictResolution?: "latest_wins" | "trust_priority" | "human_review" | undefined;
    retentionDays?: number | undefined;
    knowledgeSources?: {
        type: "document_store" | "api_realtime" | "database" | "embedding_index" | "structured_kb";
        sourceId: string;
        authScope: string;
        priority?: number | undefined;
        refreshInterval?: string | undefined;
        endpoint?: string | undefined;
    }[] | undefined;
    retrievalStrategy?: {
        strategy?: "exact" | "semantic" | "keyword" | "hybrid" | undefined;
        maxResults?: number | undefined;
        minRelevanceScore?: number | undefined;
        rerankEnabled?: boolean | undefined;
    } | undefined;
    freshnessPolicy?: {
        maxStalenessHours?: number | undefined;
        refreshTrigger?: "scheduled" | "on_demand" | "event_driven" | undefined;
        backgroundRefreshEnabled?: boolean | undefined;
    } | undefined;
}>;
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;
export type RetrievalStrategy = z.infer<typeof RetrievalStrategySchema>;
export type FreshnessPolicy = z.infer<typeof FreshnessPolicySchema>;
export type DomainKnowledgeSchema = z.infer<typeof DomainKnowledgeSchemaSchema>;
export declare function resolveKnowledgeNamespaces(schema: DomainKnowledgeSchema, additionalNamespaceIds?: readonly string[]): string[];
