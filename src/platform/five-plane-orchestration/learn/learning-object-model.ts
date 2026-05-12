import { z } from "zod";

export const PHASE_1_LEARNING_TYPES = [
  "failure_pattern",
  "user_correction",
  "recovery_playbook",
] as const;

export type Phase1LearningType = typeof PHASE_1_LEARNING_TYPES[number];
export type LearningObjectKind = Phase1LearningType;
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
  readonly createdAt: string;
  readonly validatedAt?: string;
  readonly promotedAt?: string;
}

export function normalizeLearningObjectPromotionStatus(
  promotionStatus: LearningObjectPromotionStatus,
): Exclude<LearningObjectPromotionStatus, "quarantine"> {
  return promotionStatus === "quarantine" ? "quarantined" : promotionStatus;
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
  learningType: z.enum(PHASE_1_LEARNING_TYPES).optional(),
  kind: z.enum(PHASE_1_LEARNING_TYPES).optional(),
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  content: LearningObjectContentSchema.optional(),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string()).default([]),
  sourceSignalIds: z.array(z.string()).default([]),
  recommendation: z.string().min(1).optional(),
  validatedBy: z.enum(["none", "evidence", "human_review", "shadow_execution"]).default("none"),
  promotionStatus: LearningObjectPromotionStatusSchema.optional(),
  status: z.enum(["created", "validating", "validated", "rejected", "promoted"]).optional(),
  createdAt: z.string(),
  validatedAt: z.string().optional(),
  promotedAt: z.string().optional(),
});

function statusFromPromotionStatus(promotionStatus: LearningObjectPromotionStatus): LearningObjectStatus {
  switch (promotionStatus) {
    case "draft":
    case "untrusted":
      return "created";
    case "validating":
      return "validating";
    case "validated":
      return "validated";
    case "promoted":
      return "promoted";
    case "quarantine":
    case "quarantined":
    case "retired":
      return "rejected";
  }
}

function promotionStatusFromStatus(status: LearningObjectStatus): LearningObjectPromotionStatus {
  switch (status) {
    case "created":
      return "untrusted";
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
  learningType: Phase1LearningType | "model_retraining" | "dataset_gap",
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

export function parseLearningObject(input: unknown): LearningObject {
  const parsed = LearningObjectSchema.parse(input);
  const objectId = parsed.objectId ?? parsed.learningObjectId;
  if (objectId == null) {
    throw new Error("learning.object_id_required");
  }
  const kind = parsed.kind ?? parsed.learningType;
  if (kind == null) {
    throw new Error("learning.kind_required");
  }
  const content = parsed.content ?? {
    title: parsed.title ?? "",
    summary: parsed.summary ?? "",
    evidenceRefs: parsed.evidenceRefs,
    sourceSignalIds: parsed.sourceSignalIds,
    recommendation: parsed.recommendation ?? "",
  };
  const promotionStatus = parsed.promotionStatus ?? (
    parsed.status != null
      ? promotionStatusFromStatus(parsed.status)
      : "untrusted"
  );
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
