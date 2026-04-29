import { z } from "zod";

export const ImprovementChangeScopeSchema = z.enum(["prompt", "policy", "model", "workflow", "tool_config"]);
export const ImprovementCandidateStatusSchema = z.enum([
  "candidate_created",
  "under_review",
  "proposed",
  "evaluating",
  "approved",
  "rejected",
  "shadow_running",
  "rolled_back",
]);

export const ImprovementGuardrailSchema = z.object({
  code: z.string().min(1),
  description: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  passed: z.boolean(),
  checkedAt: z.number().int().nonnegative(),
});

export const ImprovementSourceSchema = z.enum(["failure_pattern", "user_correction", "recovery_playbook"]);
export const ImprovementTargetScopeSchema = z.enum(["task", "workflow", "domain", "platform"]);
export const ImprovementPrioritySchema = z.enum(["critical", "high", "medium", "low"]);

export const ImprovementCandidateSchema = z.object({
  candidateId: z.string().min(1),
  learningObjectId: z.string().min(1),
  taskId: z.string().min(1),
  source: ImprovementSourceSchema,
  targetScope: ImprovementTargetScopeSchema,
  sourceSignalRefs: z.array(z.string()).default([]),
  sourceLearningObjectIds: z.array(z.string()).default([]),
  changeScope: ImprovementChangeScopeSchema,
  priority: ImprovementPrioritySchema,
  description: z.string().min(1),
  expectedBenefit: z.string().min(1),
  status: ImprovementCandidateStatusSchema.default("candidate_created"),
  guardrails: z.array(ImprovementGuardrailSchema).default([]),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative().optional(),
});

export type ImprovementChangeScope = z.infer<typeof ImprovementChangeScopeSchema>;
export type ImprovementCandidateStatus = z.infer<typeof ImprovementCandidateStatusSchema>;
export type ImprovementGuardrail = z.infer<typeof ImprovementGuardrailSchema>;
export type ImprovementSource = z.infer<typeof ImprovementSourceSchema>;
export type ImprovementTargetScope = z.infer<typeof ImprovementTargetScopeSchema>;
export type ImprovementPriority = z.infer<typeof ImprovementPrioritySchema>;
export type ImprovementCandidate = z.infer<typeof ImprovementCandidateSchema>;

export function parseImprovementCandidate(input: unknown): ImprovementCandidate {
  return ImprovementCandidateSchema.parse(input);
}
