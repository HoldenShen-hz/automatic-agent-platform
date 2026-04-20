import { z } from "zod";

/**
 * Knowledge source for domain knowledge schema.
 * As defined in architecture doc §37.4 DomainKnowledgeSchema.
 */
export const KnowledgeSourceSchema = z.object({
  sourceId: z.string().min(1),
  type: z.enum(["document_store", "api_realtime", "database", "embedding_index", "structured_kb"]),
  priority: z.number().int().min(0).max(100).default(50),
  refreshInterval: z.string().min(1).default("1d"),
  authScope: z.string().min(1),
  endpoint: z.string().optional(),
});

/**
 * Retrieval strategy for domain knowledge.
 * As defined in architecture doc §37.4 DomainKnowledgeSchema.
 */
export const RetrievalStrategySchema = z.object({
  strategy: z.enum(["semantic", "keyword", "hybrid", "exact"]).default("semantic"),
  maxResults: z.number().int().positive().default(10),
  minRelevanceScore: z.number().min(0).max(1).default(0.7),
  rerankEnabled: z.boolean().default(false),
});

/**
 * Freshness policy for domain knowledge.
 * As defined in architecture doc §37.4 DomainKnowledgeSchema.
 */
export const FreshnessPolicySchema = z.object({
  maxStalenessHours: z.number().int().positive().default(24),
  refreshTrigger: z.enum(["on_demand", "scheduled", "event_driven"]).default("scheduled"),
  backgroundRefreshEnabled: z.boolean().default(true),
});

export const DomainKnowledgeSchemaSchema = z.object({
  schemaId: z.string().min(1),
  domainId: z.string().min(1),
  namespaceIds: z.array(z.string()).default([]),
  freshnessWindowHours: z.number().int().positive().default(24),
  conflictResolution: z.enum(["latest_wins", "trust_priority", "human_review"]).default("trust_priority"),
  retentionDays: z.number().int().positive().default(30),
  // §37.4 enhanced fields
  knowledgeSources: z.array(KnowledgeSourceSchema).default([]),
  retrievalStrategy: RetrievalStrategySchema.default({}),
  freshnessPolicy: FreshnessPolicySchema.default({}),
});

export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;
export type RetrievalStrategy = z.infer<typeof RetrievalStrategySchema>;
export type FreshnessPolicy = z.infer<typeof FreshnessPolicySchema>;
export type DomainKnowledgeSchema = z.infer<typeof DomainKnowledgeSchemaSchema>;

export function resolveKnowledgeNamespaces(
  schema: DomainKnowledgeSchema,
  additionalNamespaceIds: readonly string[] = [],
): string[] {
  const combined = [...schema.namespaceIds, ...additionalNamespaceIds];
  return combined.filter((item, index) => combined.indexOf(item) === index);
}
