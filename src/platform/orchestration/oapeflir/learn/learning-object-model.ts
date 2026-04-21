import { z } from "zod";

export const LearningObjectSchema = z.object({
  learningObjectId: z.string().min(1),
  learningType: z.enum(["failure_pattern", "user_correction", "recovery_playbook", "model_retraining", "dataset_gap"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string()).default([]),
  sourceSignalIds: z.array(z.string()).default([]),
  recommendation: z.string().min(1),
  validatedBy: z.enum(["none", "evidence", "human_review", "shadow_execution"]).default("none"),
  promotionStatus: z.enum(["draft", "validated", "promoted", "retired"]).default("draft"),
  createdAt: z.number().int().nonnegative(),
});

export type LearningObject = z.infer<typeof LearningObjectSchema>;

export function parseLearningObject(input: unknown): LearningObject {
  return LearningObjectSchema.parse(input);
}
