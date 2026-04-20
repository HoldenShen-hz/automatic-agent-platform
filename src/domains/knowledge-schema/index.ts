import { z } from "zod";

export const DomainKnowledgeSchemaSchema = z.object({
  schemaId: z.string().min(1),
  domainId: z.string().min(1),
  namespaceIds: z.array(z.string()).default([]),
  freshnessWindowHours: z.number().int().positive().default(24),
  conflictResolution: z.enum(["latest_wins", "trust_priority", "human_review"]).default("trust_priority"),
  retentionDays: z.number().int().positive().default(30),
});

export type DomainKnowledgeSchema = z.infer<typeof DomainKnowledgeSchemaSchema>;

export function resolveKnowledgeNamespaces(
  schema: DomainKnowledgeSchema,
  additionalNamespaceIds: readonly string[] = [],
): string[] {
  return [...new Set([...schema.namespaceIds, ...additionalNamespaceIds])];
}
