import { z } from "zod";
import { RolloutLevelSchema, RolloutMetricsSchema } from "./rollout-record.js";

export const ImprovementChangeScopeSchema = z.enum(["prompt", "policy", "model", "workflow", "tool_config"]);
export const ImprovementCandidateSourceSchema = z.enum(["failure_pattern", "user_correction", "recovery_playbook"]);
export const ImprovementTargetScopeSchema = z.enum(["task", "workflow", "domain", "platform"]);
export const ImprovementPrioritySchema = z.enum(["critical", "high", "medium", "low"]);
export const ImprovementGuardrailSchema = z.object({
  guardrailId: z.string().min(1),
  description: z.string().min(1),
  requiredLevel: RolloutLevelSchema.default("L1_evaluate"),
});
export const ImprovementCandidateStatusSchema = z.enum([
  "proposed",
  "evaluating",
  "draft",
  "pending_approval",
  "shadow",
  "candidate_created",
  "under_review",
  "approved",
  "accepted",
  "shadow_running",
  "evaluation_enabled",
  "canary_5",
  "partial_25",
  "partial_50",
  "partial_75",
  "stable",
  "stable_75",
  "stable_100",
  "released",
  "deployed",
  "rejected",
  "rolled_back",
]);

export const ImprovementCandidateSchema = z.object({
  candidateId: z.string().min(1),
  taskId: z.string().min(1),
  learningObjectId: z.string().min(1).default("missing_learning_object"),
  source: ImprovementCandidateSourceSchema.default("failure_pattern"),
  targetScope: ImprovementTargetScopeSchema.default("task"),
  priority: ImprovementPrioritySchema.default("medium"),
  rolloutLevel: RolloutLevelSchema.default("L0_off"),
  metrics: RolloutMetricsSchema.default({
    errorRate: 0,
    latencyP99: 0,
    successRate: 1,
    sampleCount: 0,
  }),
  guardrails: z.array(ImprovementGuardrailSchema).default([]),
  sourceSignalRefs: z.array(z.string()).default([]),
  sourceLearningObjectIds: z.array(z.string()).default([]),
  changeScope: ImprovementChangeScopeSchema,
  description: z.string().min(1),
  expectedBenefit: z.string().min(1),
  status: ImprovementCandidateStatusSchema,
  createdAt: z.union([z.string().min(1), z.number().int().nonnegative()]),
  updatedAt: z.union([z.string().min(1), z.number().int().nonnegative()]).optional(),
});

export type ImprovementChangeScope = z.infer<typeof ImprovementChangeScopeSchema>;
export type ImprovementCandidateSource = z.infer<typeof ImprovementCandidateSourceSchema>;
export type ImprovementTargetScope = z.infer<typeof ImprovementTargetScopeSchema>;
export type ImprovementPriority = z.infer<typeof ImprovementPrioritySchema>;
export type ImprovementGuardrail = z.infer<typeof ImprovementGuardrailSchema>;
export type ImprovementCandidateStatus = z.infer<typeof ImprovementCandidateStatusSchema>;
export type ImprovementCandidate = z.infer<typeof ImprovementCandidateSchema>;

export function parseImprovementCandidate(input: unknown): ImprovementCandidate {
  const candidate = (input ?? {}) as Partial<ImprovementCandidate>;
  return ImprovementCandidateSchema.parse({
    ...candidate,
    learningObjectId: candidate.learningObjectId ?? candidate.sourceLearningObjectIds?.[0] ?? "",
    updatedAt: candidate.updatedAt ?? candidate.createdAt,
  });
}
