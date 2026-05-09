import { z } from "zod";

export const LearningObjectPromotionStatusSchema = z.enum([
  "draft",
  "untrusted",
  "validating",
  "quarantine",
  "quarantined",
  "validated",
  "promoted",
  "retired",
]);

export type LearningObjectPromotionStatus = z.infer<typeof LearningObjectPromotionStatusSchema>;

export function normalizeLearningObjectPromotionStatus(
  promotionStatus: LearningObjectPromotionStatus,
): Exclude<LearningObjectPromotionStatus, "quarantine"> {
  return promotionStatus === "quarantine" ? "quarantined" : promotionStatus;
}

export const LearningObjectSchema = z.object({
  learningObjectId: z.string().min(1),
  learningType: z.enum(["failure_pattern", "user_correction", "recovery_playbook"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string()).default([]),
  sourceSignalIds: z.array(z.string()).default([]),
  recommendation: z.string().min(1),
  validatedBy: z.enum(["none", "evidence", "human_review", "shadow_execution"]).default("none"),
  promotionStatus: LearningObjectPromotionStatusSchema.default("untrusted"),
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
