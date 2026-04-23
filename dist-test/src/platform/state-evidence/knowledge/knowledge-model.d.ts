import { z } from "zod";
export declare const TrustLevelSchema: z.ZodEnum<["verified", "reviewed", "community", "unverified"]>;
export declare const KnowledgeNamespaceSchema: z.ZodObject<{
    namespaceId: z.ZodString;
    path: z.ZodString;
    description: z.ZodString;
    ownerDomainId: z.ZodString;
    accessPolicy: z.ZodDefault<z.ZodEnum<["public", "domain_only", "restricted"]>>;
    freshnessPolicy: z.ZodObject<{
        maxAgeDays: z.ZodNumber;
        staleAction: z.ZodEnum<["warn", "demote", "archive", "delete"]>;
        refreshStrategy: z.ZodEnum<["manual", "on_access", "scheduled"]>;
        refreshIntervalHours: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        maxAgeDays: number;
        staleAction: "warn" | "delete" | "demote" | "archive";
        refreshStrategy: "manual" | "scheduled" | "on_access";
        refreshIntervalHours: number | null;
    }, {
        maxAgeDays: number;
        staleAction: "warn" | "delete" | "demote" | "archive";
        refreshStrategy: "manual" | "scheduled" | "on_access";
        refreshIntervalHours?: number | null | undefined;
    }>;
    trustLevel: z.ZodEnum<["verified", "reviewed", "community", "unverified"]>;
    maxDocuments: z.ZodDefault<z.ZodNumber>;
    maxTotalSizeBytes: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
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
}, {
    path: string;
    freshnessPolicy: {
        maxAgeDays: number;
        staleAction: "warn" | "delete" | "demote" | "archive";
        refreshStrategy: "manual" | "scheduled" | "on_access";
        refreshIntervalHours?: number | null | undefined;
    };
    trustLevel: "verified" | "community" | "unverified" | "reviewed";
    description: string;
    namespaceId: string;
    ownerDomainId: string;
    accessPolicy?: "restricted" | "public" | "domain_only" | undefined;
    maxDocuments?: number | undefined;
    maxTotalSizeBytes?: number | undefined;
}>;
export declare const ChunkingConfigSchema: z.ZodObject<{
    mode: z.ZodEnum<["fixed", "section_aware", "semantic"]>;
    fixedConfig: z.ZodOptional<z.ZodObject<{
        maxTokens: z.ZodNumber;
        overlapTokens: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        maxTokens: number;
        overlapTokens: number;
    }, {
        maxTokens: number;
        overlapTokens: number;
    }>>;
    sectionConfig: z.ZodOptional<z.ZodObject<{
        headingLevels: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
        codeBoundaries: z.ZodDefault<z.ZodArray<z.ZodEnum<["function", "class", "module"]>, "many">>;
        maxTokensPerSection: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        headingLevels: number[];
        codeBoundaries: ("function" | "class" | "module")[];
        maxTokensPerSection: number;
    }, {
        maxTokensPerSection: number;
        headingLevels?: number[] | undefined;
        codeBoundaries?: ("function" | "class" | "module")[] | undefined;
    }>>;
    semanticConfig: z.ZodOptional<z.ZodObject<{
        modelId: z.ZodString;
        minTokens: z.ZodNumber;
        maxTokens: z.ZodNumber;
        coherenceThreshold: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        maxTokens: number;
        modelId: string;
        minTokens: number;
        coherenceThreshold: number;
    }, {
        maxTokens: number;
        modelId: string;
        minTokens: number;
        coherenceThreshold: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    mode: "semantic" | "fixed" | "section_aware";
    fixedConfig?: {
        maxTokens: number;
        overlapTokens: number;
    } | undefined;
    sectionConfig?: {
        headingLevels: number[];
        codeBoundaries: ("function" | "class" | "module")[];
        maxTokensPerSection: number;
    } | undefined;
    semanticConfig?: {
        maxTokens: number;
        modelId: string;
        minTokens: number;
        coherenceThreshold: number;
    } | undefined;
}, {
    mode: "semantic" | "fixed" | "section_aware";
    fixedConfig?: {
        maxTokens: number;
        overlapTokens: number;
    } | undefined;
    sectionConfig?: {
        maxTokensPerSection: number;
        headingLevels?: number[] | undefined;
        codeBoundaries?: ("function" | "class" | "module")[] | undefined;
    } | undefined;
    semanticConfig?: {
        maxTokens: number;
        modelId: string;
        minTokens: number;
        coherenceThreshold: number;
    } | undefined;
}>;
export declare const KnowledgeSourceSchema: z.ZodObject<{
    sourceId: z.ZodString;
    type: z.ZodEnum<["file", "url", "text", "api_spec", "code_snippet"]>;
    uri: z.ZodString;
    contentHash: z.ZodString;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    ingestedAt: z.ZodString;
    namespace: z.ZodString;
    language: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    trustLevel: z.ZodEnum<["verified", "reviewed", "community", "unverified"]>;
    freshnessTimestamp: z.ZodString;
    checksum: z.ZodString;
    chunking: z.ZodOptional<z.ZodObject<{
        mode: z.ZodEnum<["fixed", "section_aware", "semantic"]>;
        fixedConfig: z.ZodOptional<z.ZodObject<{
            maxTokens: z.ZodNumber;
            overlapTokens: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            maxTokens: number;
            overlapTokens: number;
        }, {
            maxTokens: number;
            overlapTokens: number;
        }>>;
        sectionConfig: z.ZodOptional<z.ZodObject<{
            headingLevels: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
            codeBoundaries: z.ZodDefault<z.ZodArray<z.ZodEnum<["function", "class", "module"]>, "many">>;
            maxTokensPerSection: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            headingLevels: number[];
            codeBoundaries: ("function" | "class" | "module")[];
            maxTokensPerSection: number;
        }, {
            maxTokensPerSection: number;
            headingLevels?: number[] | undefined;
            codeBoundaries?: ("function" | "class" | "module")[] | undefined;
        }>>;
        semanticConfig: z.ZodOptional<z.ZodObject<{
            modelId: z.ZodString;
            minTokens: z.ZodNumber;
            maxTokens: z.ZodNumber;
            coherenceThreshold: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            maxTokens: number;
            modelId: string;
            minTokens: number;
            coherenceThreshold: number;
        }, {
            maxTokens: number;
            modelId: string;
            minTokens: number;
            coherenceThreshold: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        mode: "semantic" | "fixed" | "section_aware";
        fixedConfig?: {
            maxTokens: number;
            overlapTokens: number;
        } | undefined;
        sectionConfig?: {
            headingLevels: number[];
            codeBoundaries: ("function" | "class" | "module")[];
            maxTokensPerSection: number;
        } | undefined;
        semanticConfig?: {
            maxTokens: number;
            modelId: string;
            minTokens: number;
            coherenceThreshold: number;
        } | undefined;
    }, {
        mode: "semantic" | "fixed" | "section_aware";
        fixedConfig?: {
            maxTokens: number;
            overlapTokens: number;
        } | undefined;
        sectionConfig?: {
            maxTokensPerSection: number;
            headingLevels?: number[] | undefined;
            codeBoundaries?: ("function" | "class" | "module")[] | undefined;
        } | undefined;
        semanticConfig?: {
            maxTokens: number;
            modelId: string;
            minTokens: number;
            coherenceThreshold: number;
        } | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "text" | "url" | "file" | "api_spec" | "code_snippet";
    sourceId: string;
    uri: string;
    namespace: string;
    trustLevel: "verified" | "community" | "unverified" | "reviewed";
    language: string | null;
    metadata: Record<string, unknown>;
    checksum: string;
    tags: string[];
    contentHash: string;
    ingestedAt: string;
    freshnessTimestamp: string;
    chunking?: {
        mode: "semantic" | "fixed" | "section_aware";
        fixedConfig?: {
            maxTokens: number;
            overlapTokens: number;
        } | undefined;
        sectionConfig?: {
            headingLevels: number[];
            codeBoundaries: ("function" | "class" | "module")[];
            maxTokensPerSection: number;
        } | undefined;
        semanticConfig?: {
            maxTokens: number;
            modelId: string;
            minTokens: number;
            coherenceThreshold: number;
        } | undefined;
    } | undefined;
}, {
    type: "text" | "url" | "file" | "api_spec" | "code_snippet";
    sourceId: string;
    uri: string;
    namespace: string;
    trustLevel: "verified" | "community" | "unverified" | "reviewed";
    checksum: string;
    contentHash: string;
    ingestedAt: string;
    freshnessTimestamp: string;
    language?: string | null | undefined;
    metadata?: Record<string, unknown> | undefined;
    tags?: string[] | undefined;
    chunking?: {
        mode: "semantic" | "fixed" | "section_aware";
        fixedConfig?: {
            maxTokens: number;
            overlapTokens: number;
        } | undefined;
        sectionConfig?: {
            maxTokensPerSection: number;
            headingLevels?: number[] | undefined;
            codeBoundaries?: ("function" | "class" | "module")[] | undefined;
        } | undefined;
        semanticConfig?: {
            maxTokens: number;
            modelId: string;
            minTokens: number;
            coherenceThreshold: number;
        } | undefined;
    } | undefined;
}>;
export declare const KnowledgeChunkSchema: z.ZodObject<{
    chunkId: z.ZodString;
    documentId: z.ZodString;
    content: z.ZodString;
    chunkType: z.ZodEnum<["concept", "rule", "constraint", "example", "api_signature", "error_pattern"]>;
    metadata: z.ZodDefault<z.ZodObject<{
        language: z.ZodOptional<z.ZodString>;
        framework: z.ZodOptional<z.ZodString>;
        relevantFiles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        relevantFiles: string[];
        language?: string | undefined;
        framework?: string | undefined;
    }, {
        language?: string | undefined;
        relevantFiles?: string[] | undefined;
        framework?: string | undefined;
    }>>;
    embedding: z.ZodDefault<z.ZodNullable<z.ZodArray<z.ZodNumber, "many">>>;
    tokenCount: z.ZodNumber;
    namespace: z.ZodString;
    ordinal: z.ZodNumber;
    summary: z.ZodString;
    keywords: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    embeddingId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    locator: z.ZodDefault<z.ZodObject<{
        page: z.ZodOptional<z.ZodNumber>;
        section: z.ZodOptional<z.ZodString>;
        lineStart: z.ZodOptional<z.ZodNumber>;
        lineEnd: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        page?: number | undefined;
        section?: string | undefined;
        lineStart?: number | undefined;
        lineEnd?: number | undefined;
    }, {
        page?: number | undefined;
        section?: string | undefined;
        lineStart?: number | undefined;
        lineEnd?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    summary: string;
    content: string;
    tokenCount: number;
    namespace: string;
    documentId: string;
    chunkId: string;
    metadata: {
        relevantFiles: string[];
        language?: string | undefined;
        framework?: string | undefined;
    };
    keywords: string[];
    embedding: number[] | null;
    chunkType: "rule" | "concept" | "constraint" | "example" | "api_signature" | "error_pattern";
    ordinal: number;
    embeddingId: string | null;
    locator: {
        page?: number | undefined;
        section?: string | undefined;
        lineStart?: number | undefined;
        lineEnd?: number | undefined;
    };
}, {
    summary: string;
    content: string;
    tokenCount: number;
    namespace: string;
    documentId: string;
    chunkId: string;
    chunkType: "rule" | "concept" | "constraint" | "example" | "api_signature" | "error_pattern";
    ordinal: number;
    metadata?: {
        language?: string | undefined;
        relevantFiles?: string[] | undefined;
        framework?: string | undefined;
    } | undefined;
    keywords?: string[] | undefined;
    embedding?: number[] | null | undefined;
    embeddingId?: string | null | undefined;
    locator?: {
        page?: number | undefined;
        section?: string | undefined;
        lineStart?: number | undefined;
        lineEnd?: number | undefined;
    } | undefined;
}>;
export declare const KnowledgeDocumentSchema: z.ZodObject<{
    documentId: z.ZodString;
    sourceId: z.ZodString;
    title: z.ZodString;
    version: z.ZodNumber;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    domainScope: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodDefault<z.ZodEnum<["draft", "indexed", "archived", "deprecated"]>>;
    namespace: z.ZodString;
    mimeType: z.ZodString;
    rawText: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    structuredText: z.ZodDefault<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    archived: z.ZodDefault<z.ZodBoolean>;
    archivedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    archived: boolean;
    status: "draft" | "deprecated" | "archived" | "indexed";
    sourceId: string;
    version: number;
    title: string;
    namespace: string;
    documentId: string;
    mimeType: string;
    tags: string[];
    archivedAt: string | null;
    domainScope: string[];
    rawText: string | null;
    structuredText: Record<string, unknown> | null;
}, {
    sourceId: string;
    version: number;
    title: string;
    namespace: string;
    documentId: string;
    mimeType: string;
    archived?: boolean | undefined;
    status?: "draft" | "deprecated" | "archived" | "indexed" | undefined;
    tags?: string[] | undefined;
    archivedAt?: string | null | undefined;
    domainScope?: string[] | undefined;
    rawText?: string | null | undefined;
    structuredText?: Record<string, unknown> | null | undefined;
}>;
export declare const RetrievalHitSchema: z.ZodObject<{
    chunkId: z.ZodString;
    documentId: z.ZodString;
    score: z.ZodNumber;
    matchType: z.ZodEnum<["semantic", "keyword", "structural"]>;
    snippet: z.ZodString;
    namespace: z.ZodString;
    knowledgeRef: z.ZodString;
    reasoningSummary: z.ZodOptional<z.ZodString>;
    rankingSignals: z.ZodOptional<z.ZodObject<{
        keywordMatches: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        exactMatchScore: z.ZodNumber;
        semanticSimilarity: z.ZodNumber;
        keywordCoverage: z.ZodNumber;
        sharedKeywordNeighborCount: z.ZodNumber;
        sameDocumentNeighborCount: z.ZodNumber;
        trustMultiplier: z.ZodNumber;
        freshnessMultiplier: z.ZodNumber;
        namespaceBoost: z.ZodNumber;
        graphBoost: z.ZodNumber;
        reasoningPaths: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
        exactMatchScore: number;
        semanticSimilarity: number;
        keywordCoverage: number;
        sharedKeywordNeighborCount: number;
        sameDocumentNeighborCount: number;
        trustMultiplier: number;
        freshnessMultiplier: number;
        namespaceBoost: number;
        graphBoost: number;
        keywordMatches?: string[] | undefined;
        reasoningPaths?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
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
}, {
    namespace: string;
    documentId: string;
    chunkId: string;
    snippet: string;
    score: number;
    matchType: "semantic" | "keyword" | "structural";
    knowledgeRef: string;
    reasoningSummary?: string | undefined;
    rankingSignals?: {
        exactMatchScore: number;
        semanticSimilarity: number;
        keywordCoverage: number;
        sharedKeywordNeighborCount: number;
        sameDocumentNeighborCount: number;
        trustMultiplier: number;
        freshnessMultiplier: number;
        namespaceBoost: number;
        graphBoost: number;
        keywordMatches?: string[] | undefined;
        reasoningPaths?: string[] | undefined;
    } | undefined;
}>;
export declare const SourceTrustPolicySchema: z.ZodObject<{
    level: z.ZodEnum<["verified", "reviewed", "community", "unverified"]>;
    allowedInFinalResponse: z.ZodBoolean;
    requiresCitation: z.ZodBoolean;
    maxRetrievalWeight: z.ZodNumber;
    humanReviewRequired: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    level: "verified" | "community" | "unverified" | "reviewed";
    allowedInFinalResponse: boolean;
    requiresCitation: boolean;
    maxRetrievalWeight: number;
    humanReviewRequired: boolean;
}, {
    level: "verified" | "community" | "unverified" | "reviewed";
    allowedInFinalResponse: boolean;
    requiresCitation: boolean;
    maxRetrievalWeight: number;
    humanReviewRequired: boolean;
}>;
export type TrustLevel = z.infer<typeof TrustLevelSchema>;
export type KnowledgeNamespace = z.infer<typeof KnowledgeNamespaceSchema>;
export type ChunkingConfig = z.infer<typeof ChunkingConfigSchema>;
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;
export type KnowledgeChunk = z.infer<typeof KnowledgeChunkSchema>;
export type RetrievalHit = z.infer<typeof RetrievalHitSchema>;
export type SourceTrustPolicy = z.infer<typeof SourceTrustPolicySchema>;
