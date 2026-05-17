import { z } from "zod";

export const PHASE_1_LEARNING_TYPES = [
  "failure_pattern",
  "user_correction",
  "recovery_playbook",
] as const;

export type Phase1LearningType = typeof PHASE_1_LEARNING_TYPES[number];
export type DeprecatedLearningType = "model_retraining" | "dataset_gap";
export type LearningObjectKind = Phase1LearningType | DeprecatedLearningType;
export type LearningObjectStatus = "created" | "validating" | "validated" | "rejected" | "promoted";

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

export interface LearningObjectContent {
  readonly title: string;
  readonly summary: string;
  readonly evidenceRefs: readonly string[];
  readonly sourceSignalIds: readonly string[];
  readonly recommendation: string;
}

export interface LearningObject {
  readonly learningObjectId: string;
  readonly objectId: string;
  readonly learningType: LearningObjectKind;
  readonly kind: LearningObjectKind;
  readonly title: string;
  readonly summary: string;
  readonly content: LearningObjectContent;
  readonly confidence: number;
  readonly evidenceRefs: readonly string[];
  readonly sourceSignalIds: readonly string[];
  readonly recommendation: string;
  readonly validatedBy: "none" | "evidence" | "human_review" | "shadow_execution";
  readonly promotionStatus: LearningObjectPromotionStatus;
  readonly status: LearningObjectStatus;
  readonly createdAt: string | number;
  readonly validatedAt?: string | number;
  readonly promotedAt?: string | number;
}

export function normalizeLearningObjectPromotionStatus(
  promotionStatus: LearningObjectPromotionStatus,
): LearningObjectPromotionStatus {
  return promotionStatus;
}

const LearningObjectContentSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([]),
  sourceSignalIds: z.array(z.string()).default([]),
  recommendation: z.string().min(1),
});

export const LearningObjectSchema = z.object({
  learningObjectId: z.string().min(1).optional(),
  objectId: z.string().min(1).optional(),
  learningType: z.union([z.enum(PHASE_1_LEARNING_TYPES), z.enum(["model_retraining", "dataset_gap"])]).optional(),
  kind: z.union([z.enum(PHASE_1_LEARNING_TYPES), z.enum(["model_retraining", "dataset_gap"])]).optional(),
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  content: LearningObjectContentSchema.optional(),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string()).default([]),
  sourceSignalIds: z.array(z.string()).default([]),
  recommendation: z.string().min(1).optional(),
  validatedBy: z.enum(["none", "evidence", "human_review", "shadow_execution"]).default("none"),
  promotionStatus: LearningObjectPromotionStatusSchema.default("quarantine"),
  status: z.enum(["created", "validating", "validated", "rejected", "promoted"]).optional(),
  createdAt: z.union([z.string(), z.number().int().nonnegative()]),
  validatedAt: z.union([z.string(), z.number().int().nonnegative()]).optional(),
  promotedAt: z.union([z.string(), z.number().int().nonnegative()]).optional(),
}).superRefine((value, context) => {
  const content = value.content;
  const title = value.title ?? content?.title;
  const summary = value.summary ?? content?.summary;
  const recommendation = value.recommendation ?? content?.recommendation;

  if (title == null || title.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "LearningObject title is required",
      path: ["title"],
    });
  }
  if (summary == null || summary.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "LearningObject summary is required",
      path: ["summary"],
    });
  }
  if (recommendation == null || recommendation.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "LearningObject recommendation is required",
      path: ["recommendation"],
    });
  }
});

function statusFromPromotionStatus(promotionStatus: LearningObjectPromotionStatus): LearningObjectStatus {
  switch (promotionStatus) {
    case "draft":
    case "untrusted":
    case "quarantine":
      return "created";
    case "validating":
      return "validating";
    case "validated":
      return "validated";
    case "promoted":
      return "promoted";
    case "quarantined":
    case "retired":
      return "rejected";
  }
}

function promotionStatusFromStatus(status: LearningObjectStatus): LearningObjectPromotionStatus {
  switch (status) {
    case "created":
      return "quarantine";
    case "validating":
      return "validating";
    case "validated":
      return "validated";
    case "promoted":
      return "promoted";
    case "rejected":
      return "quarantined";
  }
}

export function normalizeLearningType(
  learningType: Phase1LearningType | DeprecatedLearningType,
): Phase1LearningType {
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

export function preserveLearningType(
  learningType: Phase1LearningType | DeprecatedLearningType,
): LearningObjectKind {
  return learningType;
}

export function parseLearningObject(input: unknown): LearningObject {
  const parsed = LearningObjectSchema.parse(input);
  const inputRecord = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
  const objectId = parsed.objectId ?? parsed.learningObjectId;
  if (objectId == null) {
    throw new Error("learning.object_id_required");
  }
  const rawKind = parsed.kind ?? parsed.learningType;
  if (rawKind == null) {
    throw new Error("learning.kind_required");
  }
  const kind = preserveLearningType(rawKind);
  const content = parsed.content ?? {
    title: parsed.title ?? "",
    summary: parsed.summary ?? "",
    evidenceRefs: parsed.evidenceRefs,
    sourceSignalIds: parsed.sourceSignalIds,
    recommendation: parsed.recommendation ?? "",
  };
  const promotionStatus = parsed.status != null && !Object.prototype.hasOwnProperty.call(inputRecord, "promotionStatus")
      ? promotionStatusFromStatus(parsed.status)
      : parsed.promotionStatus;
  const status = parsed.status ?? statusFromPromotionStatus(promotionStatus);

  return {
    learningObjectId: objectId,
    objectId,
    learningType: kind,
    kind,
    title: parsed.title ?? content.title,
    summary: parsed.summary ?? content.summary,
    content,
    confidence: parsed.confidence,
    evidenceRefs: parsed.evidenceRefs.length > 0 ? parsed.evidenceRefs : content.evidenceRefs,
    sourceSignalIds: parsed.sourceSignalIds.length > 0 ? parsed.sourceSignalIds : content.sourceSignalIds,
    recommendation: parsed.recommendation ?? content.recommendation,
    validatedBy: parsed.validatedBy,
    promotionStatus,
    status,
    createdAt: parsed.createdAt,
    ...(parsed.validatedAt != null ? { validatedAt: parsed.validatedAt } : {}),
    ...(parsed.promotedAt != null ? { promotedAt: parsed.promotedAt } : {}),
  };
}
