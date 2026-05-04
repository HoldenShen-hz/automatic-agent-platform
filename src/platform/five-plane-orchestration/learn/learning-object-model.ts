import { z } from "zod";

export const LearningObjectSchema = z.object({
  learningObjectId: z.string().min(1),
  // R26-34 FIX: Phase 1 only supports 3 learning types per ADR-080 §R4-TYPES constraint
  // Removed model_retraining/dataset_gap - not in Phase 1 scope
  learningType: z.enum(["failure_pattern", "user_correction", "recovery_playbook"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string()).default([]),
  sourceSignalIds: z.array(z.string()).default([]),
  recommendation: z.string().min(1),
  validatedBy: z.enum(["none", "evidence", "human_review", "shadow_execution"]).default("none"),
  promotionStatus: z.enum(["draft", "quarantine", "validated", "promoted", "retired"]).default("quarantine"),
  createdAt: z.string(),
});

export type LearningObject = z.infer<typeof LearningObjectSchema>;

export function normalizeLearningType(
  learningType: LearningObject["learningType"] | "model_retraining" | "dataset_gap",
): LearningObject["learningType"] {
  switch (learningType) {
    case "failure_pattern":
    case "user_correction":
    case "recovery_playbook":
      return learningType;
    case "model_retraining":
      return "user_correction";
    case "dataset_gap":
      return "failure_pattern";
  }
}

export function parseLearningObject(input: unknown): LearningObject {
  return LearningObjectSchema.parse(input);
}
