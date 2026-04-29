import { z } from "zod";

export const TrustLevelSchema = z.enum(["private_unverified", "team_reviewed", "official", "authoritative"]);

export const KnowledgeNamespaceSchema = z.object({
  namespaceId: z.string().min(1),
  path: z.string().min(1),
  description: z.string().min(1),
  ownerDomainId: z.string().min(1),
  accessPolicy: z.enum(["public", "domain_only", "restricted"]).default("public"),
  freshnessPolicy: z.object({
    maxAgeDays: z.number().int().positive(),
    staleAction: z.enum(["warn", "demote", "archive", "delete"]),
    refreshStrategy: z.enum(["manual", "on_access", "scheduled"]),
    refreshIntervalHours: z.number().int().positive().nullable().default(null),
  }),
  trustLevel: TrustLevelSchema,
  maxDocuments: z.number().int().positive().default(1000),
  maxTotalSizeBytes: z.number().int().positive().default(10 * 1024 * 1024),
});

export const ChunkingConfigSchema = z.object({
  mode: z.enum(["fixed", "section_aware", "semantic"]),
  fixedConfig: z.object({
    maxTokens: z.number().int().positive(),
    overlapTokens: z.number().int().nonnegative(),
  }).optional(),
  sectionConfig: z.object({
    headingLevels: z.array(z.number().int().positive()).default([]),
    codeBoundaries: z.array(z.enum(["function", "class", "module"])).default([]),
    maxTokensPerSection: z.number().int().positive(),
  }).optional(),
  semanticConfig: z.object({
    modelId: z.string().min(1),
    minTokens: z.number().int().positive(),
    maxTokens: z.number().int().positive(),
    coherenceThreshold: z.number().min(0).max(1),
  }).optional(),
});

export const KnowledgeSourceSchema = z.object({
  sourceId: z.string().min(1),
  type: z.enum(["file", "url", "text", "api_spec", "code_snippet"]),
  uri: z.string().min(1),
  contentHash: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
  ingestedAt: z.string().min(1),
  namespace: z.string().min(1),
  language: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  trustLevel: TrustLevelSchema,
  freshnessTimestamp: z.string().min(1),
  checksum: z.string().min(1),
  chunking: ChunkingConfigSchema.optional(),
});

export const KnowledgeChunkSchema = z.object({
  chunkId: z.string().min(1),
  documentId: z.string().min(1),
  content: z.string().min(1),
  chunkType: z.enum(["concept", "rule", "constraint", "example", "api_signature", "error_pattern"]),
  metadata: z.object({
    language: z.string().optional(),
    framework: z.string().optional(),
    relevantFiles: z.array(z.string()).default([]),
  }).default({ relevantFiles: [] }),
  embedding: z.array(z.number()).nullable().default(null),
  tokenCount: z.number().int().positive(),
  namespace: z.string().min(1),
  ordinal: z.number().int().nonnegative(),
  summary: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  embeddingId: z.string().nullable().default(null),
  locator: z.object({
    page: z.number().int().positive().optional(),
    section: z.string().optional(),
    lineStart: z.number().int().positive().optional(),
    lineEnd: z.number().int().positive().optional(),
  }).default({}),
});

export const KnowledgeDocumentSchema = z.object({
  documentId: z.string().min(1),
  sourceId: z.string().min(1),
  title: z.string().min(1),
  version: z.number().int().positive(),
  tags: z.array(z.string()).default([]),
  domainScope: z.array(z.string()).default([]),
  status: z.enum(["draft", "indexed", "archived", "deprecated"]).default("draft"),
  namespace: z.string().min(1),
  mimeType: z.string().min(1),
  rawText: z.string().nullable().default(null),
  structuredText: z.record(z.string(), z.unknown()).nullable().default(null),
  archived: z.boolean().default(false),
  archivedAt: z.string().nullable().default(null),
});

export const RetrievalHitSchema = z.object({
  chunkId: z.string().min(1),
  documentId: z.string().min(1),
  score: z.number(),
  matchType: z.enum(["semantic", "keyword", "structural"]),
  snippet: z.string().min(1),
  namespace: z.string().min(1),
  knowledgeRef: z.string().min(1),
  reasoningSummary: z.string().min(1).optional(),
  rankingSignals: z.object({
    keywordMatches: z.array(z.string()).default([]),
    exactMatchScore: z.number(),
    semanticSimilarity: z.number().min(0).max(1),
    keywordCoverage: z.number().min(0).max(1),
    sharedKeywordNeighborCount: z.number().int().nonnegative(),
    sameDocumentNeighborCount: z.number().int().nonnegative(),
    trustMultiplier: z.number().min(0),
    freshnessMultiplier: z.number().min(0),
    namespaceBoost: z.number().min(0),
    graphBoost: z.number(),
    reasoningPaths: z.array(z.string()).default([]),
  }).optional(),
});

export const SourceTrustPolicySchema = z.object({
  level: TrustLevelSchema,
  allowedInFinalResponse: z.boolean(),
  requiresCitation: z.boolean(),
  maxRetrievalWeight: z.number().min(0).max(1),
  humanReviewRequired: z.boolean(),
});

export type TrustLevel = z.infer<typeof TrustLevelSchema>;
export type KnowledgeNamespace = z.infer<typeof KnowledgeNamespaceSchema>;
export type ChunkingConfig = z.infer<typeof ChunkingConfigSchema>;
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;
export type KnowledgeChunk = z.infer<typeof KnowledgeChunkSchema>;
export type RetrievalHit = z.infer<typeof RetrievalHitSchema>;
export type SourceTrustPolicy = z.infer<typeof SourceTrustPolicySchema>;
