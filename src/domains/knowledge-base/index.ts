import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const KnowledgeBaseTaskTypeSchema = z.enum(["ingest", "search", "curate"]);
export type KnowledgeBaseTaskType = z.infer<typeof KnowledgeBaseTaskTypeSchema>;

export const KNOWLEDGE_BASE_DOMAIN_PRESET = createDomainModulePreset("knowledge-base", ["ingest", "search", "curate"] as const, ["curate"] as const);
export type KnowledgeBaseDomainPreset = typeof KNOWLEDGE_BASE_DOMAIN_PRESET;

export function requiresKnowledgeBaseReview(taskType: KnowledgeBaseTaskType): boolean {
  return requiresPresetReview(KNOWLEDGE_BASE_DOMAIN_PRESET, taskType);
}
